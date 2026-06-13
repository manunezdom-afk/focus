#!/usr/bin/env node
// 30 casos COMPLEJOS para HOY — validación local contra Anthropic real
// (ruteo Haiku→Sonnet de producción). Asserta categorización (icon),
// subtítulos por-evento, horas (AM/PM por contexto), fecha=HOY,
// recordatorios y ediciones. NO toca producción. Uso:
//   node scripts/validate-today-30.mjs
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
let apiKey = process.env.ANTHROPIC_API_KEY?.trim()
if (!apiKey) {
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
    const m = env.split('\n').find(l => l.startsWith('ANTHROPIC_API_KEY='))
    if (m) apiKey = m.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  } catch {}
}
if (!apiKey) { console.error('✗ Falta ANTHROPIC_API_KEY'); process.exit(2) }
const client = new Anthropic({ apiKey })
const HAIKU = 'claude-haiku-4-5-20251001', SONNET = 'claude-sonnet-4-6'
const dc = buildDateContext(Date.now(), 'America/Santiago')
const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const resolveDate = t => t === 'today' ? dc.todayISO : t === 'tomorrow' ? dc.tomorrow : t

async function callC({ system, history, message, model, extra = '' }) {
  return client.messages.create({ model, max_tokens: 2048, system,
    messages: [...history, { role: 'user', content: message }, ...(extra ? [{ role: 'user', content: extra }] : [])] })
}
async function run(c) {
  const events = (c.events || []).map(e => ({ ...e, date: resolveDate(e.date) || e.date }))
  const system = buildSystemPrompt({ dateContext: dc, weatherContext: 'Ubicación no disponible.', contacts: [],
    profile: null, behavior: null, memories: [], events, tasks: [], novaPersonality: 'focus', discussedEventIds: c.discussed || [] })
  const history = c.history || []
  const lastUser = [...history].reverse().find(h => h.role === 'user')?.content || ''
  const scope = `${lastUser}\n${c.input}`
  const isComplex = __detectComplexInput(c.input) || __isClarificationReply(history)
  let parsed = null
  if (isComplex) {
    const d = await callC({ system, history, message: c.input, model: SONNET })
    parsed = safeParseAssistantJSON((d.content?.[0]?.text ?? '').trim())
  } else {
    const d1 = await callC({ system, history, message: c.input, model: HAIKU })
    let hp = null; try { hp = safeParseAssistantJSON((d1.content?.[0]?.text ?? '').trim()) } catch {}
    const pre = filterCalendarEditActions(Array.isArray(hp?.actions) ? hp.actions : [], scope)
    const esc = !hp || d1.stop_reason === 'max_tokens' || (d1.usage?.output_tokens || 0) > 1780
      || pre.stripped.length > 0 || (typeof hp?.confidence === 'number' ? hp.confidence : 1) < 0.55
    if (esc) { const d2 = await callC({ system, history, message: c.input, model: SONNET, extra: 'Devuelve SOLO el JSON.' })
      try { parsed = safeParseAssistantJSON((d2.content?.[0]?.text ?? '').trim()) } catch { parsed = hp } } else parsed = hp
  }
  const out = { mode: parsed.mode, reply: parsed.reply || '', actions: Array.isArray(parsed.actions) ? parsed.actions : [] }
  const ef = filterCalendarEditActions(out.actions, scope)
  if (ef.stripped.length > 0) out.actions = ef.actions
  return out
}
const ev = (out, n) => out.actions.find(a => (a.type === 'add_event' || a.type === 'add_recurring_event') && norm(a.event?.title).includes(norm(n)))
const editA = out => out.actions.find(a => a.type === 'edit_event')
// Familia de iconos deporte/entrenamiento que iOS mapea a .entrenamiento.
const SPORT_ICONS = new Set(['fitness_center', 'directions_run', 'directions_bike', 'directions_walk', 'pool', 'hiking', 'sports'])
const isSport = ic => SPORT_ICONS.has((ic || '').toLowerCase()) || (ic || '').toLowerCase().startsWith('sports_')
function evaluate(c, out) {
  const e = c.expect, f = []
  const evs = out.actions.filter(a => a.type === 'add_event' || a.type === 'add_recurring_event')
  const tasks = out.actions.filter(a => a.type === 'add_task')
  if (e.minActions != null && out.actions.length < e.minActions) f.push(`acciones ${out.actions.length}<${e.minActions}`)
  if (e.today) for (const a of evs) { const d = a.event?.date ?? dc.todayISO; if (d !== dc.todayISO) f.push(`${a.event?.title}: date=${d} no es HOY`) }
  for (const [n, ic] of Object.entries(e.iconFor || {})) { const a = ev(out, n); if (!a) { f.push(`falta evento ~${n}`); continue } const ok = ic === 'fitness_center' ? isSport(a.event?.icon) : a.event?.icon === ic; if (!ok) f.push(`${n}: icon=${a.event?.icon} (esperaba ${ic === 'fitness_center' ? 'deporte' : ic})`) }
  for (const n of e.sportFor || []) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (!isSport(a.event?.icon)) f.push(`${n}: icon=${a.event?.icon} no es de deporte (no mapea a Entrenamiento)`) }
  for (const [n, sub] of Object.entries(e.subtitleFor || {})) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (!norm(a.event?.subtitle).includes(norm(sub))) f.push(`${n}: subtitle="${a.event?.subtitle}" (esperaba ~${sub})`) }
  for (const [n, sub] of Object.entries(e.titleOrSubFor || {})) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (!norm(a.event?.title + ' ' + (a.event?.subtitle || '')).includes(norm(sub))) f.push(`${n}: ni título ni subtítulo contienen ~${sub}`) }
  for (const [n, t] of Object.entries(e.timeFor || {})) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (norm(a.event?.time) !== norm(t)) f.push(`${n}: time=${a.event?.time} (esperaba ${t})`) }
  for (const [n, off] of Object.entries(e.reminderFor || {})) { const a = ev(out, n); const offs = a?.event?.reminderOffsets || []; if (!offs.includes(off)) f.push(`${n}: reminderOffsets=${JSON.stringify(offs)} (esperaba incluir ${off})`) }
  for (const n of e.taskFor || []) { if (!tasks.some(t => norm(t.task?.label).includes(norm(n)))) f.push(`falta tarea ~${n}`) }
  if (e.editTime && !(editA(out)?.updates?.time && norm(editA(out).updates.time) === norm(e.editTime))) f.push(`edit.time=${editA(out)?.updates?.time} (esperaba ${e.editTime})`)
  if (e.editSubtitle && !norm(editA(out)?.updates?.subtitle).includes(norm(e.editSubtitle))) f.push(`edit.subtitle=${editA(out)?.updates?.subtitle} (esperaba ~${e.editSubtitle})`)
  if (e.reminderIcon) { const a = out.actions.find(a => a.type === 'add_event'); if (a && a.event?.icon !== 'alarm') f.push(`recordatorio icon=${a.event?.icon} (esperaba alarm)`) }
  if (e.chatOnly && out.actions.filter(a => a.type !== 'remember').length > 0) f.push(`creó acciones (esperaba solo chat)`)
  return f
}

const C = [
  // ── multi-evento mismo día + categorías mixtas + subtítulos ──
  { input: 'hoy tengo gimnasio a las 6 de pierna y luego cena a las 9 con mi novia en un italiano', expect: { today: true, minActions: 2, iconFor: { gimnasio: 'fitness_center' }, subtitleFor: { gimnasio: 'pierna' }, timeFor: { gimnasio: '6:00 PM', cena: '9:00 PM' } } },
  { input: 'para hoy: reunión con el equipo a las 4 para revisar el roadmap, y a las 5:30 llamada con el cliente sobre el contrato', expect: { today: true, minActions: 2, iconFor: { reuni: 'groups' }, subtitleFor: { reuni: 'roadmap', llamada: 'contrato' } } },
  { input: 'hoy almuerzo a la 1 con mi mamá, dentista a las 4 llevar la radiografía, y gym a las 7 enfocado en espalda', expect: { today: true, minActions: 3, iconFor: { almuerzo: 'restaurant', dentista: 'local_hospital', gym: 'fitness_center' }, subtitleFor: { dentista: 'radiograf', gym: 'espalda' } } },
  { input: 'hoy: gym a las 6 de pierna, reunión a las 8 para el cierre de mes, y cena a las 10 para celebrar', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center', reuni: 'groups' }, subtitleFor: { gym: 'pierna', reuni: 'cierre', cena: 'celebr' } } },
  { input: 'hoy reunión a las 9 de la mañana, gym al mediodía de pierna, y cena a las 8 con amigos', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center' }, subtitleFor: { gym: 'pierna' }, timeFor: { reuni: '9:00 AM', cena: '8:00 PM' } } },
  { input: 'agéndame hoy estudiar cálculo a las 3 y a las 8 ver una película', expect: { today: true, minActions: 2, iconFor: { calculo: 'menu_book' }, timeFor: { calculo: '3:00 PM', pel: '8:00 PM' } } },
  // ── deporte → fitness_center (zona del bug) ──
  { input: 'hoy correr a las 6 de la mañana', expect: { today: true, iconFor: { correr: 'fitness_center' }, timeFor: { correr: '6:00 AM' } } },
  { input: 'hoy tenis a las 5', expect: { today: true, iconFor: { tenis: 'fitness_center' }, timeFor: { tenis: '5:00 PM' } } },
  { input: 'natación hoy a las 7 de la tarde', expect: { today: true, iconFor: { nataci: 'fitness_center' }, timeFor: { nataci: '7:00 PM' } } },
  { input: 'hoy crossfit a las 6 de la tarde', expect: { today: true, iconFor: { crossfit: 'fitness_center' } } },
  { input: 'hoy fútbol con los chicos a las 7, llevar las canilleras', expect: { today: true, iconFor: { fut: 'fitness_center' }, subtitleFor: { fut: 'canillera' }, timeFor: { fut: '7:00 PM' } } },
  { input: 'hoy yoga a las 6 de la tarde y a las 9 meditar', expect: { today: true, minActions: 2, iconFor: { yoga: 'fitness_center' } } },
  // ── recordatorios ──
  { input: 'hoy a las 3 reunión importante, recuérdame una hora antes', expect: { today: true, reminderFor: { reuni: 60 }, timeFor: { reuni: '3:00 PM' } } },
  { input: 'hoy llamar al banco a las 11 y recuérdame 15 minutos antes', expect: { today: true, reminderFor: { llamar: 15 } } },
  { input: 'recuérdame hoy a las 5 sacar la basura', expect: { today: true, reminderIcon: true, timeFor: { basura: '5:00 PM' } } },
  { input: 'tomar la pastilla hoy a las 9 de la noche, que no se me olvide', expect: { today: true, reminderIcon: true, timeFor: { pastilla: '9:00 PM' } } },
  // ── ambigüedad AM/PM por contexto, HOY ──
  { input: 'hoy desayuno a las 8 con Pedro', expect: { today: true, iconFor: { desayun: 'restaurant' }, timeFor: { desayun: '8:00 AM' } } },
  { input: 'hoy cena a las 8', expect: { today: true, iconFor: { cena: 'restaurant' }, timeFor: { cena: '8:00 PM' } } },
  { input: 'café con Ana hoy a las 4', expect: { today: true, timeFor: { caf: '4:00 PM' } } },
  { input: 'hoy almuerzo de trabajo a la 1 para discutir el presupuesto', expect: { today: true, iconFor: { almuerzo: 'restaurant' }, subtitleFor: { almuerzo: 'presupuesto' }, timeFor: { almuerzo: '1:00 PM' } } },
  // ── ediciones / memoria (events + history) ──
  { events: [{ id: 'g1', title: 'Gimnasio', time: '6:00 PM', date: 'today' }], discussed: ['g1'],
    history: [{ role: 'user', content: 'agéndame gimnasio hoy a las 6' }, { role: 'assistant', content: 'Listo, Gimnasio hoy a las 6:00 PM.' }],
    input: 'muévelo una hora antes', expect: { editTime: '5:00 PM' } },
  { events: [{ id: 'r1', title: 'Reunión con diseño', time: '4:00 PM', date: 'today' }], discussed: ['r1'],
    history: [{ role: 'user', content: 'reunión con diseño hoy a las 4' }, { role: 'assistant', content: 'Listo, Reunión con diseño hoy a las 4:00 PM.' }],
    input: 'ponle que lleve el laptop', expect: { editSubtitle: 'laptop' } },
  { events: [{ id: 'c1', title: 'Cena', time: '9:00 PM', date: 'today' }], discussed: ['c1'],
    history: [{ role: 'user', content: 'cena hoy a las 9' }, { role: 'assistant', content: 'Listo, Cena hoy a las 9:00 PM.' }],
    input: 'cámbiala a las 9 y media', expect: { editTime: '9:30 PM' } },
  // ── evento + tarea juntos ──
  { input: 'hoy comprar pan y leche, y a las 7 gimnasio de hombro', expect: { today: true, iconFor: { gimnasio: 'fitness_center' }, subtitleFor: { gimnasio: 'hombro' }, taskFor: ['pan'] } },
  { input: 'agéndame hoy clase de inglés a las 5 y tarea de matemáticas', expect: { today: true, iconFor: { ingl: 'menu_book' }, timeFor: { ingl: '5:00 PM' }, taskFor: ['matem'] } },
  // ── everyday tricky ──
  { input: 'hoy tipo 3 y media reunión rápida con diseño', expect: { today: true, iconFor: { reuni: 'groups' }, timeFor: { reuni: '3:30 PM' } } },
  { input: 'hoy terapia a las 4 y gym a las 6 de hombro', expect: { today: true, minActions: 2, iconFor: { gym: 'fitness_center' }, subtitleFor: { gym: 'hombro' } } },
  { input: 'hoy a las 6 fútbol y a las 6 también llamar a mi hermano', expect: { today: true, minActions: 2, iconFor: { fut: 'fitness_center' } } },
  { input: 'hoy entreno piernas a las 8 de la noche', expect: { today: true, iconFor: { entren: 'fitness_center' }, titleOrSubFor: { entren: 'pierna' }, timeFor: { entren: '8:00 PM' } } },
  // ── conversacional / consejo (no crear) ──
  { input: 'hoy me siento sin energía, ¿qué me recomiendas para aprovechar la tarde?', expect: { chatOnly: true } },
]

let pass = 0, fail = 0
for (let i = 0; i < C.length; i++) {
  const c = C[i]
  try {
    const out = await run(c)
    const fails = evaluate(c, out)
    if (fails.length === 0) { pass++; console.log(`✅ [${i + 1}/30] ${c.input.slice(0, 60)}`) }
    else { fail++; console.log(`❌ [${i + 1}/30] ${c.input.slice(0, 60)}`)
      console.log(`     reply: ${out.reply.replace(/\n/g, ' ').slice(0, 90)}`)
      console.log(`     acts: ${JSON.stringify(out.actions.map(a => ({ t: a.type, ti: a.event?.title || a.task?.label, ic: a.event?.icon, sub: a.event?.subtitle, tm: a.event?.time || a.updates?.time, ro: a.event?.reminderOffsets })))}`)
      console.log('     ' + fails.join('\n     ')) }
  } catch (e) { fail++; console.log(`❌ [${i + 1}/30] ERROR: ${e?.message || e}`) }
}
console.log(`\n═══ RESULTADO: ${pass}/${C.length} PASS (${fail} FAIL) ═══`)
process.exit(fail === 0 ? 0 : 1)
