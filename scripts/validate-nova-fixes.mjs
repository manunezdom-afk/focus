#!/usr/bin/env node
// Validación LOCAL de los fixes 2026-06-13 (subtítulos múltiples +
// editar-por-pronombre + coherencia) contra el modelo REAL de Anthropic,
// replicando el ruteo de producción (Haiku → escala a Sonnet). NO toca
// producción: corre el handler/prompt local con la ANTHROPIC_API_KEY de
// .env.local. Uso: node scripts/validate-nova-fixes.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { buildDateContext } from '../api/_lib/dateContext.js'
import { buildSystemPrompt } from '../api/_lib/systemPrompt.js'
import { safeParseAssistantJSON } from '../api/_lib/neutralize.js'
import { filterCalendarEditActions, strippedEditMessage } from '../api/_lib/calendarIntent.js'
import { __detectComplexInput, __isClarificationReply } from '../api/focus-assistant.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Cargar ANTHROPIC_API_KEY de .env.local si no está en el entorno.
let apiKey = process.env.ANTHROPIC_API_KEY?.trim()
if (!apiKey) {
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
    const m = env.split('\n').find(l => l.startsWith('ANTHROPIC_API_KEY='))
    if (m) apiKey = m.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  } catch {}
}
if (!apiKey) { console.error('✗ Falta ANTHROPIC_API_KEY (env o .env.local)'); process.exit(2) }

const client = new Anthropic({ apiKey })
const HAIKU = 'claude-haiku-4-5-20251001'
const SONNET = 'claude-sonnet-4-6'
const dateContext = buildDateContext(Date.now(), 'America/Santiago')
const RETRY = 'Devuelve EXCLUSIVAMENTE el objeto JSON del schema.'

function resolveDate(t) {
  if (t === 'today') return dateContext.todayISO
  if (t === 'tomorrow') return dateContext.tomorrow
  if (t === '+2') return dateContext.dayAfter
  return t
}
async function call({ system, history, message, model, extra = '' }) {
  return client.messages.create({
    model, max_tokens: 2048, system,
    messages: [...history, { role: 'user', content: message }, ...(extra ? [{ role: 'user', content: extra }] : [])],
  })
}
async function run(c) {
  const events = (c.events || []).map(e => ({ ...e, date: resolveDate(e.date) || e.date }))
  const system = buildSystemPrompt({
    dateContext, weatherContext: 'Ubicación no disponible.', contacts: [], profile: null,
    behavior: null, memories: [], events, tasks: [], novaPersonality: 'focus',
    discussedEventIds: c.discussed || [],
  })
  const history = c.history || []
  const lastUser = [...history].reverse().find(h => h.role === 'user')?.content || ''
  const scope = `${lastUser}\n${c.input}`
  const isComplex = __detectComplexInput(c.input) || __isClarificationReply(history)
  let parsed = null
  if (isComplex) {
    const d = await call({ system, history, message: c.input, model: SONNET })
    parsed = safeParseAssistantJSON((d.content?.[0]?.text ?? '').trim())
  } else {
    const d1 = await call({ system, history, message: c.input, model: HAIKU })
    let hp = null; try { hp = safeParseAssistantJSON((d1.content?.[0]?.text ?? '').trim()) } catch {}
    const pre = filterCalendarEditActions(Array.isArray(hp?.actions) ? hp.actions : [], scope)
    const escalate = !hp || d1.stop_reason === 'max_tokens' || (d1.usage?.output_tokens || 0) > 1780
      || pre.stripped.length > 0 || (typeof hp?.confidence === 'number' ? hp.confidence : 1) < 0.55
    if (escalate) {
      const d2 = await call({ system, history, message: c.input, model: SONNET, extra: RETRY })
      try { parsed = safeParseAssistantJSON((d2.content?.[0]?.text ?? '').trim()) } catch { parsed = hp }
    } else parsed = hp
  }
  const out = { mode: parsed.mode, reply: parsed.reply || '', actions: Array.isArray(parsed.actions) ? parsed.actions : [] }
  const ef = filterCalendarEditActions(out.actions, scope)
  if (ef.stripped.length > 0) { out.actions = ef.actions; out.reply += '\n' + strippedEditMessage(ef.stripped) }
  return out
}
const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function subtitleOf(out, titleNeedle) {
  const a = out.actions.find(a => a.type === 'add_event' && norm(a.event?.title).includes(norm(titleNeedle)))
  return a ? (a.event?.subtitle || '') : '__NO_EVENT__'
}

const scenarios = [
  {
    name: 'multi-subtitle (3 eventos, cada uno su subtítulo)',
    input: 'Para mañana agéndame gimnasio a las 7 enfocado en pierna, reunión de equipo a las 10 para cerrar el presupuesto y cena a las 8 con Ana para celebrar su cumpleaños',
    check: (out) => {
      const g = subtitleOf(out, 'gimnasio'), r = subtitleOf(out, 'reuni'), c = subtitleOf(out, 'cena')
      const fails = []
      if (!norm(g).includes('pierna')) fails.push(`gimnasio.subtitle="${g}" (esperaba ~pierna)`)
      if (!norm(r).includes('presupuesto')) fails.push(`reunion.subtitle="${r}" (esperaba ~presupuesto)`)
      if (!norm(c).includes('cumple')) fails.push(`cena.subtitle="${c}" (esperaba ~cumpleaños)`)
      return fails
    },
  },
  {
    name: 'editar-por-pronombre ("muévela una hora antes")',
    events: [{ id: 'ev-plomero', title: 'Llamada con el plomero', time: '5:00 PM', date: 'today' }],
    discussed: ['ev-plomero'],
    history: [
      { role: 'user', content: 'agéndame una llamada con el plomero hoy a las 5 de la tarde' },
      { role: 'assistant', content: 'Listo, Llamada con el plomero hoy a las 5:00 PM.' },
    ],
    input: 'muévela una hora antes',
    check: (out) => {
      const edit = out.actions.find(a => a.type === 'edit_event')
      const fails = []
      if (!edit) { fails.push(`NO emitió edit_event (actions=${out.actions.length}, mode=${out.mode})`); return fails }
      if (edit.id !== 'ev-plomero') fails.push(`edit.id="${edit.id}" (esperaba ev-plomero)`)
      const t = edit.updates?.time
      if (!t || !/4:00\s*PM/i.test(t)) fails.push(`edit.updates.time="${t}" (esperaba 4:00 PM)`)
      return fails
    },
  },
]

let allPass = true
for (const s of scenarios) {
  process.stdout.write(`\n▶ ${s.name}\n`)
  try {
    const out = await run(s)
    const fails = s.check(out)
    console.log(`   reply: ${out.reply.replace(/\n/g, ' ').slice(0, 140)}`)
    console.log(`   actions: ${JSON.stringify(out.actions.map(a => ({ t: a.type, title: a.event?.title, sub: a.event?.subtitle, id: a.id, time: a.updates?.time })))}`)
    if (fails.length === 0) console.log('   ✅ PASS')
    else { allPass = false; console.log('   ❌ FAIL:\n     - ' + fails.join('\n     - ')) }
  } catch (e) { allPass = false; console.log('   ❌ ERROR: ' + (e?.message || e)) }
}
console.log(`\n${allPass ? '✅ TODOS PASS' : '❌ HAY FALLOS'}`)
process.exit(allPass ? 0 : 1)
