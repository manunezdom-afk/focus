#!/usr/bin/env node
// Batería QA de Nova — runner EN VIVO contra el provider de producción.
//
// Ejecuta los casos de tests/nova-battery/cases.json contra el pipeline
// REAL y evalúa las expectativas declaradas. No necesita servidor,
// Supabase ni auth — solo la API key del provider.
//
// Providers:
//   anthropic (DEFAULT — producción 2026-06-10): replica el ruteo de
//     api/focus-assistant.js → Haiku 4.5 para inputs simples, Sonnet 4.6
//     directo para inputs complejos/continuaciones, escalación a Sonnet
//     cuando Haiku tropieza, y la defensa filterCalendarEditActions.
//   openai (legacy): buildOpenAISystemPrompt → OpenAI Responses →
//     convertOpenAIToBackendResponse.
//
// Uso:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/run-nova-battery.mjs
//   node scripts/run-nova-battery.mjs --provider openai   (usa OPENAI_API_KEY)
//   node scripts/run-nova-battery.mjs --only A1,B12
//   node scripts/run-nova-battery.mjs --cat multi
//
// Salida: resumen en consola + reporte markdown en docs/NOVA_BATTERY_REPORT.md
// con columnas: Test ID / Input / Esperado / Real / Pass-Fail / Notas.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import Anthropic from '@anthropic-ai/sdk'

import { buildDateContext } from '../api/_lib/dateContext.js'
import { buildSystemPrompt } from '../api/_lib/systemPrompt.js'
import { safeParseAssistantJSON } from '../api/_lib/neutralize.js'
import { filterCalendarEditActions, strippedEditMessage } from '../api/_lib/calendarIntent.js'
import { __detectComplexInput, __isClarificationReply } from '../api/focus-assistant.js'
import {
  buildOpenAISystemPrompt,
  callOpenAINova,
  extractResponsesText,
  convertOpenAIToBackendResponse,
} from '../api/_lib/openaiNova.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CASES_PATH = join(ROOT, 'tests/nova-battery/cases.json')
const REPORT_PATH = join(ROOT, 'docs/NOVA_BATTERY_REPORT.md')

// Mismos IDs que api/focus-assistant.js (MODEL_ID / FALLBACK_MODEL_ID).
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-4-6'

const args = process.argv.slice(2)
const onlyIds = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null
const onlyCat = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
const provider = (args.includes('--provider')
  ? args[args.indexOf('--provider') + 1]
  : (process.env.NOVA_BATTERY_PROVIDER || 'anthropic')).toLowerCase()

const apiKey = provider === 'anthropic'
  ? process.env.ANTHROPIC_API_KEY?.trim()
  : process.env.OPENAI_API_KEY?.trim()
if (!apiKey) {
  console.error(`✗ Falta ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'}. La batería llama al modelo real de producción.`)
  console.error('  Uso: ANTHROPIC_API_KEY=sk-ant-... node scripts/run-nova-battery.mjs [--provider anthropic|openai]')
  process.exit(2)
}

// Anthropic: el system prompt completo pesa ~10k tokens y el ITPM de la org
// es 50k/min — con concurrencia 5 la batería revienta el rate limit (429).
// Concurrencia 2 + reintentos con backoff del SDK lo mantienen bajo el techo.
const CONCURRENCY = provider === 'anthropic' ? 2 : 5

const { cases } = JSON.parse(readFileSync(CASES_PATH, 'utf8'))
const dateContext = buildDateContext(Date.now(), process.env.NOVA_BATTERY_TZ || 'America/Santiago')

// ─── Helpers de evaluación ──────────────────────────────────────────────────

const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function resolveDateToken(token) {
  if (token == null) return null
  if (token === 'today') return dateContext.todayISO
  if (token === 'tomorrow') return dateContext.tomorrow
  if (token === '+2') return dateContext.dayAfter
  if (token.startsWith('weekday:')) {
    const day = norm(token.slice(8))
    for (const [name, iso] of Object.entries(dateContext.weekDates)) {
      if (norm(name) === day) return iso
    }
    return null
  }
  return token
}

function to24Minutes(t12) {
  const m = /^(\d{1,2}):(\d{2})\s(AM|PM)$/.exec(t12 || '')
  if (!m) return null
  let h = parseInt(m[1], 10) % 12 + (m[3] === 'PM' ? 12 : 0)
  return h * 60 + parseInt(m[2], 10)
}

function nowMinutes() {
  const [h, m] = dateContext.currentTime24.split(':').map(Number)
  return h * 60 + m
}

function classify(out) {
  const kinds = new Set()
  for (const a of out.actions) {
    if (a.type === 'add_event') kinds.add(a.event?.icon === 'alarm' ? 'reminder' : 'event')
    if (a.type === 'add_recurring_event') kinds.add('event')
    if (a.type === 'add_task') kinds.add('task')
    if (a.type === 'edit_event') kinds.add('edit')
    if (a.type === 'delete_event') kinds.add('delete')
  }
  if (out.actions.length >= 2) kinds.add('multi')
  if (out.actions.length === 0) {
    kinds.add(out.mode === 'clarification' || out.shouldAskUser ? 'clarify' : 'chat')
  }
  return kinds
}

function someActionText(out, fields, needles) {
  const haystacks = []
  for (const a of out.actions) {
    for (const f of fields) {
      if (f === 'title' && a.event?.title) haystacks.push(a.event.title)
      if (f === 'label' && a.task?.label) haystacks.push(a.task.label)
      if (f === 'subtitle' && a.event?.subtitle) haystacks.push(a.event.subtitle)
      if (f === 'location' && a.event?.location) haystacks.push(a.event.location)
      if (f === 'notes' && a.event?.notes) haystacks.push(a.event.notes)
    }
  }
  return needles.some(n => haystacks.some(h => norm(h).includes(norm(n))))
}

function evaluate(c, out) {
  const e = c.expect
  const fails = []
  const kinds = classify(out)
  const clarified = kinds.has('clarify')

  // allowClarify: una clarificación razonable cuenta como pass total.
  if (clarified && e.allowClarify) return { pass: true, fails: [], note: 'clarify aceptado' }

  const wanted = e.kind ? [e.kind] : (e.kindAnyOf || [])
  if (wanted.length > 0 && !wanted.some(k => kinds.has(k))) {
    fails.push(`kind: esperaba ${wanted.join('|')}, obtuve [${[...kinds].join(',')}]`)
  }

  if (e.minActions != null && out.actions.length < e.minActions) fails.push(`minActions: ${out.actions.length} < ${e.minActions}`)
  if (e.maxActions != null && out.actions.length > e.maxActions) fails.push(`maxActions: ${out.actions.length} > ${e.maxActions}`)

  if (e.noWrongCreate && wanted.length > 0 && !wanted.some(k => ['event', 'reminder', 'task', 'multi'].includes(k))) {
    if (out.actions.some(a => a.type === 'add_event' || a.type === 'add_task')) {
      fails.push('noWrongCreate: creó algo que no correspondía')
    }
  }

  if (e.titleIncludes && !someActionText(out, ['title', 'label'], e.titleIncludes)) fails.push(`title no contiene ${JSON.stringify(e.titleIncludes)}`)
  if (e.subtitleIncludes && !someActionText(out, ['subtitle'], e.subtitleIncludes)) fails.push(`subtitle no contiene ${JSON.stringify(e.subtitleIncludes)}`)
  if (e.subtitleOrLocationIncludes && !someActionText(out, ['subtitle', 'location', 'notes', 'title'], e.subtitleOrLocationIncludes)) fails.push(`subtitle/location no contiene ${JSON.stringify(e.subtitleOrLocationIncludes)}`)
  if (e.titleOrSubtitleIncludes && !someActionText(out, ['title', 'label', 'subtitle'], e.titleOrSubtitleIncludes)) fails.push(`title/subtitle no contiene ${JSON.stringify(e.titleOrSubtitleIncludes)}`)
  if (e.subtitleOrSecondActionIncludes) {
    const ok = someActionText(out, ['subtitle', 'notes'], e.subtitleOrSecondActionIncludes)
      || out.actions.slice(1).some(a => e.subtitleOrSecondActionIncludes.some(n => norm(a.event?.title || a.task?.label).includes(norm(n))))
      || (out.actions[0]?.event?.reminderNotes || []).some(rn => e.subtitleOrSecondActionIncludes.some(n => norm(rn).includes(norm(n))))
    if (!ok) fails.push(`detalle "${e.subtitleOrSecondActionIncludes}" no quedó como subtítulo ni acción secundaria`)
  }

  if (e.titlesInclude) {
    for (const group of e.titlesInclude) {
      if (!someActionText(out, ['title', 'label'], group)) fails.push(`falta acción con título ~ ${JSON.stringify(group)}`)
    }
  }

  const eventTimes = out.actions.map(a => a.event?.time).filter(Boolean)
  if (e.timeAnyOf && !eventTimes.some(t => e.timeAnyOf.includes(t))) fails.push(`time: esperaba ${e.timeAnyOf.join('|')}, obtuve ${eventTimes.join(',') || '(sin hora)'}`)
  if (e.timesAnyOf) {
    for (const group of e.timesAnyOf) {
      if (!eventTimes.some(t => group.includes(t))) fails.push(`falta acción a las ${group.join('|')}`)
    }
  }
  if (e.timeRelativeMinutes != null) {
    const target = (nowMinutes() + e.timeRelativeMinutes) % 1440
    const ok = eventTimes.some(t => {
      const mins = to24Minutes(t)
      if (mins == null) return false
      const diff = Math.min(Math.abs(mins - target), 1440 - Math.abs(mins - target))
      return diff <= 3
    })
    if (!ok) fails.push(`hora relativa: esperaba ahora+${e.timeRelativeMinutes}min, obtuve ${eventTimes.join(',') || '(sin hora)'}`)
  }

  if (e.date !== undefined) {
    const expected = resolveDateToken(e.date)
    const dates = out.actions.map(a => a.event?.date ?? a.updates?.date ?? null)
    const ok = dates.some(d => (d ?? dateContext.todayISO) === expected)
    if (!ok) fails.push(`date: esperaba ${expected}, obtuve ${dates.join(',') || '(ninguna)'}`)
  }

  const firstEvent = out.actions.find(a => a.event)?.event
  if (e.endTimeNull && firstEvent && firstEvent.endTime != null) fails.push(`endTime debía ser null, fue ${firstEvent.endTime}`)
  if (e.durationMinutes != null) {
    const ok = out.actions.some(a => {
      const s = to24Minutes(a.event?.time); const f = to24Minutes(a.event?.endTime)
      if (s == null || f == null) return false
      const d = (f - s + 1440) % 1440
      return Math.abs(d - e.durationMinutes) <= 5
    })
    if (!ok) fails.push(`duración: esperaba ${e.durationMinutes}min`)
  }
  if (e.maxDurationMinutes != null) {
    const bad = out.actions.some(a => {
      const s = to24Minutes(a.event?.time); const f = to24Minutes(a.event?.endTime)
      if (s == null || f == null) return false
      return ((f - s + 1440) % 1440) > e.maxDurationMinutes
    })
    if (bad) fails.push(`duración supera máx ${e.maxDurationMinutes}min`)
  }
  if (e.reminderOffsetsInclude != null) {
    const ok = out.actions.some(a => (a.event?.reminderOffsets || a.updates?.reminderOffsets || []).includes(e.reminderOffsetsInclude))
    if (!ok) fails.push(`falta reminderOffset ${e.reminderOffsetsInclude}`)
  }
  if (e.targetId) {
    const ok = out.actions.some(a => a.id === e.targetId)
    if (!ok) fails.push(`targetId: esperaba ${e.targetId}`)
  }
  if (e.updateTime) {
    const ok = out.actions.some(a => a.updates?.time === e.updateTime)
    if (!ok) fails.push(`updates.time: esperaba ${e.updateTime}`)
  }
  if (e.updateDate !== undefined) {
    const expected = resolveDateToken(e.updateDate)
    const ok = out.actions.some(a => a.updates?.date === expected)
    if (!ok) fails.push(`updates.date: esperaba ${expected}`)
  }
  if (e.replyIncludes && !e.replyIncludes.some(n => norm(out.reply).includes(norm(n)))) {
    fails.push(`reply no menciona ${JSON.stringify(e.replyIncludes)}`)
  }

  // Tono: ninguna respuesta debe sonar a bot técnico.
  const robotic = ['intención detectada', 'procediendo a', 'parámetro temporal', 'entidad temporal', 'según mis parámetros', 'no puedo realizar esa acción']
  if (robotic.some(r => norm(out.reply).includes(norm(r)))) fails.push(`reply robótico: "${out.reply.slice(0, 80)}"`)

  return { pass: fails.length === 0, fails, note: '' }
}

// ─── Ejecución ──────────────────────────────────────────────────────────────

function materializeEvents(c) {
  return (c.events || []).map(ev => ({ ...ev, date: resolveDateToken(ev.date) || ev.date }))
}

// ─── Runner Anthropic — espejo del pipeline de api/focus-assistant.js ───────
//
// Replica: ruteo complejidad/continuación → Sonnet directo; simple → Haiku
// con escalación a Sonnet (JSON inválido, confidence < 0.55, ediciones
// strippeadas, truncation); defensa filterCalendarEditActions con scope
// mensaje + último turno del usuario; strip de acciones `remember`
// (transparentes — producción no las cuenta como smart actions).

// maxRetries alto (a diferencia del 1 de producción): la batería puede
// esperar el retry-after de un 429 — un usuario real no.
const anthropicClient = provider === 'anthropic'
  ? new Anthropic({ apiKey, timeout: 120_000, maxRetries: 8 })
  : null

const SONNET_RETRY_NOTE =
  'IMPORTANTE: tu respuesta anterior con Haiku falló o emitió ediciones sin que el usuario lo pidiera. Reintenta siguiendo ESTAS REGLAS DURAS:\n' +
  '1) NUNCA uses edit_event/update_event/delete_event a menos que el usuario haya escrito un verbo explícito de edición (mueve, cambia, edita, modifica, reagenda, pásalo, corre, adelanta, atrasa, borra, elimina, cancela, quita).\n' +
  '2) Si el usuario menciona hora sin fecha, date=hoy (sin importar si la hora ya pasó). Si quería otro día, lo dirá ("mañana", "viernes").\n' +
  '3) Eventos similares de OTRO DÍA NO bloquean creación nueva — son eventos distintos.\n' +
  '4) Si dudas entre crear y editar, SIEMPRE elige add_event.\n' +
  '5) Cierra todas las llaves del JSON; sin texto fuera del objeto.'

async function callClaude({ systemPrompt, history, message, model, extra = '' }) {
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
    ...(extra ? [{ role: 'user', content: extra }] : []),
  ]
  return anthropicClient.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })
}

async function runCaseAnthropic(c) {
  const events = materializeEvents(c)
  const history = c.history || []
  const systemPrompt = buildSystemPrompt({
    dateContext,
    weatherContext: 'Ubicación no disponible — no puedes dar información del clima.',
    contacts: [],
    profile: null,
    behavior: null,
    memories: (c.memories || []).map(m =>
      typeof m === 'string' ? { category: 'context', content: m } : m),
    events,
    tasks: c.tasks || [],
    novaPersonality: 'focus',
    discussedEventIds: c.discussed || [],
  })

  const lastUserTurn = [...history].reverse().find(h => h.role === 'user')?.content || ''
  const editIntentScope = `${lastUserTurn}\n${c.input}`
  const isComplex = __detectComplexInput(c.input) || __isClarificationReply(history)

  const t0 = Date.now()
  let usedModel = isComplex ? SONNET_MODEL : HAIKU_MODEL
  try {
    let parsed = null
    if (isComplex) {
      // Path producción: complejo/continuación → Sonnet directo, con un
      // reintento de formato si el JSON viene inválido.
      const d = await callClaude({ systemPrompt, history, message: c.input, model: SONNET_MODEL })
      try {
        parsed = safeParseAssistantJSON((d.content?.[0]?.text ?? '').trim())
      } catch {
        const dRetry = await callClaude({
          systemPrompt, history, message: c.input, model: SONNET_MODEL,
          extra: 'Tu respuesta anterior NO fue JSON válido. Devuelve EXCLUSIVAMENTE el objeto JSON del schema (empieza con "{" y termina con "}"), sin texto fuera del objeto y con todas las llaves cerradas.',
        })
        parsed = safeParseAssistantJSON((dRetry.content?.[0]?.text ?? '').trim())
      }
    } else {
      const d1 = await callClaude({ systemPrompt, history, message: c.input, model: HAIKU_MODEL })
      const r1 = (d1.content?.[0]?.text ?? '').trim()
      let haikuParsed = null
      try {
        haikuParsed = safeParseAssistantJSON(r1)
      } catch {
        haikuParsed = null
      }
      const haikuActions = Array.isArray(haikuParsed?.actions) ? haikuParsed.actions : []
      const preFilter = filterCalendarEditActions(haikuActions, editIntentScope)
      const haikuConfidence = typeof haikuParsed?.confidence === 'number' ? haikuParsed.confidence : 1.0
      const escalate = !haikuParsed
        || d1.stop_reason === 'max_tokens'
        || (d1.usage?.output_tokens || 0) > 1780
        || preFilter.stripped.length > 0
        || haikuConfidence < 0.55
      if (escalate) {
        usedModel = SONNET_MODEL
        try {
          const d2 = await callClaude({
            systemPrompt, history, message: c.input, model: SONNET_MODEL, extra: SONNET_RETRY_NOTE,
          })
          parsed = safeParseAssistantJSON((d2.content?.[0]?.text ?? '').trim())
        } catch {
          if (!haikuParsed) throw new Error('Haiku y Sonnet devolvieron JSON inválido')
          usedModel = HAIKU_MODEL
          parsed = haikuParsed
        }
      } else {
        parsed = haikuParsed
      }
    }

    // finalize() de producción: defensa anti-edición + nota al reply.
    const out = { mode: parsed.mode, reply: parsed.reply || '', confidence: parsed.confidence, shouldAskUser: !!parsed.shouldAskUser, actions: Array.isArray(parsed.actions) ? parsed.actions : [] }
    const editFilter = filterCalendarEditActions(out.actions, editIntentScope)
    if (editFilter.stripped.length > 0) {
      out.actions = editFilter.actions
      const note = strippedEditMessage(editFilter.stripped)
      out.reply = `${out.reply}${out.reply ? '\n\n' : ''}${note}`
    }
    // `remember` es transparente (memoria) — no cuenta como acción visible.
    out.actions = out.actions.filter(a => a?.type !== 'remember')
    const verdict = evaluate(c, out)
    return { c, out, verdict, ms: Date.now() - t0, model: usedModel }
  } catch (err) {
    return { c, out: null, verdict: { pass: false, fails: [`ERROR: ${err.message?.slice(0, 140)}`] }, ms: Date.now() - t0, model: usedModel }
  }
}

async function runCase(c) {
  if (provider === 'anthropic') return runCaseAnthropic(c)
  const events = materializeEvents(c)
  const prompt = buildOpenAISystemPrompt({
    tz: dateContext.tz,
    todayISO: dateContext.todayISO,
    tomorrow: dateContext.tomorrow,
    dayAfter: dateContext.dayAfter,
    currentTime24: dateContext.currentTime24,
    weekDates: dateContext.weekDates,
    memories: c.memories || [],
    events,
    tasks: c.tasks || [],
    discussedEventIds: c.discussed || [],
  })
  const t0 = Date.now()
  try {
    const data = await callOpenAINova({
      message: c.input,
      systemPrompt: prompt,
      apiKey,
      reqId: `battery-${c.id}`,
      history: c.history || [],
      reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'medium',
    })
    const parsed = JSON.parse(extractResponsesText(data))
    const out = convertOpenAIToBackendResponse({
      openaiPayload: parsed,
      userMessage: c.input,
      history: c.history || [],
      reqId: `battery-${c.id}`,
      events,
    })
    const verdict = evaluate(c, out)
    return { c, out, verdict, ms: Date.now() - t0 }
  } catch (err) {
    return { c, out: null, verdict: { pass: false, fails: [`ERROR: ${err.message?.slice(0, 140)}`] }, ms: Date.now() - t0 }
  }
}

function describeActual(r) {
  if (!r.out) return '(error)'
  if (r.out.actions.length === 0) return `${r.out.mode}: "${(r.out.reply || '').slice(0, 70)}"`
  return r.out.actions.map(a => {
    if (a.type === 'add_event') {
      const ev = a.event
      return `add_event "${ev.title}"${ev.subtitle ? ` / ${ev.subtitle}` : ''} ${ev.time || 's/h'}${ev.endTime ? `–${ev.endTime}` : ''} ${ev.date || 'hoy'}${ev.icon === 'alarm' ? ' [rec]' : ''}`
    }
    if (a.type === 'add_task') return `add_task "${a.task.label}"`
    if (a.type === 'edit_event') return `edit ${a.id} ${JSON.stringify(a.updates)}`
    if (a.type === 'delete_event') return `delete ${a.id}`
    return a.type
  }).join(' + ')
}

const providerLabel = provider === 'anthropic'
  ? `anthropic (${HAIKU_MODEL} + ${SONNET_MODEL}, ruteo producción)`
  : `openai (${process.env.OPENAI_NOVA_MODEL || 'gpt-5-mini'}, reasoning ${process.env.OPENAI_REASONING_EFFORT || 'medium'})`

const selected = cases.filter(c => (!onlyIds || onlyIds.has(c.id)) && (!onlyCat || c.cat === onlyCat))
console.log(`Nova battery — ${selected.length} casos, provider ${providerLabel}, hoy=${dateContext.todayISO} ${dateContext.currentTime24}\n`)

const results = []
for (let i = 0; i < selected.length; i += CONCURRENCY) {
  const batch = selected.slice(i, i + CONCURRENCY)
  const batchResults = await Promise.all(batch.map(runCase))
  for (const r of batchResults) {
    results.push(r)
    const mark = r.verdict.pass ? '✓' : '✗'
    console.log(`${mark} ${r.c.id} (${r.ms}ms) ${r.c.input.slice(0, 60)}${r.verdict.pass ? '' : '\n    → ' + r.verdict.fails.join(' | ')}`)
  }
}

const passed = results.filter(r => r.verdict.pass).length
const byCat = {}
for (const r of results) {
  byCat[r.c.cat] = byCat[r.c.cat] || { pass: 0, total: 0 }
  byCat[r.c.cat].total++
  if (r.verdict.pass) byCat[r.c.cat].pass++
}

console.log(`\n══ RESULTADO: ${passed}/${results.length} pass ══`)
for (const [cat, s] of Object.entries(byCat)) console.log(`  ${cat}: ${s.pass}/${s.total}`)

// ─── Reporte markdown ───────────────────────────────────────────────────────

const lines = [
  '# Nova — Reporte de batería QA',
  '',
  `- Fecha de ejecución: ${new Date().toISOString()}`,
  `- Provider: ${providerLabel}`,
  `- Contexto temporal del run: hoy=${dateContext.todayISO}, hora=${dateContext.currentTime24}, tz=${dateContext.tz}`,
  `- **Total: ${passed}/${results.length} PASS**`,
  '',
  '## Por categoría',
  '',
  '| Categoría | Pass | Total |',
  '|---|---|---|',
  ...Object.entries(byCat).map(([cat, s]) => `| ${cat} | ${s.pass} | ${s.total} |`),
  '',
  '## Detalle',
  '',
  '| ID | Input | Esperado | Real | Modelo | Resultado | Notas |',
  '|---|---|---|---|---|---|---|',
  ...results.map(r => {
    const esc = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ')
    const modelShort = (r.model || '').includes('sonnet') ? 'sonnet' : (r.model ? 'haiku' : '—')
    return `| ${r.c.id} | ${esc(r.c.input)} | ${esc(JSON.stringify(r.c.expect))} | ${esc(describeActual(r))} | ${modelShort} | ${r.verdict.pass ? 'PASS' : 'FAIL'} | ${esc(r.verdict.fails.join('; ') || r.verdict.note || '')} |`
  }),
  '',
]
mkdirSync(dirname(REPORT_PATH), { recursive: true })
writeFileSync(REPORT_PATH, lines.join('\n'))
console.log(`\nReporte: ${REPORT_PATH}`)
process.exit(passed === results.length ? 0 : 1)
