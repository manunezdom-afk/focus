#!/usr/bin/env node
// Batería QA de Nova — runner EN VIVO contra OpenAI.
//
// Ejecuta los 200 casos de tests/nova-battery/cases.json contra el
// pipeline REAL de producción (buildOpenAISystemPrompt → OpenAI →
// convertOpenAIToBackendResponse) y evalúa las expectativas declaradas.
// No necesita servidor, Supabase ni auth — solo la API key.
//
// Uso:
//   OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs
//   OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs --only A1,B12
//   OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs --cat multi
//
// Salida: resumen en consola + reporte markdown en docs/NOVA_BATTERY_REPORT.md
// con columnas: Test ID / Input / Esperado / Real / Pass-Fail / Notas.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildDateContext } from '../api/_lib/dateContext.js'
import {
  buildOpenAISystemPrompt,
  callOpenAINova,
  extractResponsesText,
  convertOpenAIToBackendResponse,
} from '../api/_lib/openaiNova.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CASES_PATH = join(ROOT, 'tests/nova-battery/cases.json')
const REPORT_PATH = join(ROOT, 'docs/NOVA_BATTERY_REPORT.md')
const CONCURRENCY = 5

const apiKey = process.env.OPENAI_API_KEY?.trim()
if (!apiKey) {
  console.error('✗ Falta OPENAI_API_KEY. La batería llama al modelo real de producción.')
  console.error('  Uso: OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs')
  process.exit(2)
}

const args = process.argv.slice(2)
const onlyIds = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null
const onlyCat = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null

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

async function runCase(c) {
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

const selected = cases.filter(c => (!onlyIds || onlyIds.has(c.id)) && (!onlyCat || c.cat === onlyCat))
console.log(`Nova battery — ${selected.length} casos, modelo ${process.env.OPENAI_NOVA_MODEL || 'gpt-5-mini'}, hoy=${dateContext.todayISO} ${dateContext.currentTime24}\n`)

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
  `- Modelo: ${process.env.OPENAI_NOVA_MODEL || 'gpt-5-mini'} (reasoning ${process.env.OPENAI_REASONING_EFFORT || 'medium'})`,
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
  '| ID | Input | Esperado | Real | Resultado | Notas |',
  '|---|---|---|---|---|---|',
  ...results.map(r => {
    const esc = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ')
    return `| ${r.c.id} | ${esc(r.c.input)} | ${esc(JSON.stringify(r.c.expect))} | ${esc(describeActual(r))} | ${r.verdict.pass ? 'PASS' : 'FAIL'} | ${esc(r.verdict.fails.join('; ') || r.verdict.note || '')} |`
  }),
  '',
]
mkdirSync(dirname(REPORT_PATH), { recursive: true })
writeFileSync(REPORT_PATH, lines.join('\n'))
console.log(`\nReporte: ${REPORT_PATH}`)
process.exit(passed === results.length ? 0 : 1)
