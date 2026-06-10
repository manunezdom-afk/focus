// Tests del cierre QA de Nova (2026-06-10).
//
// Cubre los fixes deterministas del backend:
//   1. Duraciones centralizadas (durations.js) — anti "todo dura 1 hora".
//   2. Subtítulos en el contrato OpenAI (schema + adapter).
//   3. create_task → add_task (tareas sin hora por el path OpenAI).
//   4. edit_event / delete_event con targetEventId real (correcciones
//      tipo "cámbialo a las 6", "borra lo de fútbol").
//   5. Reminders conservan su hora ("acuérdame comprar pan a las 6").
//   6. Prompt OpenAI con contexto de agenda + reglas de fechas/horas/
//      duración/título-subtítulo/continuidad/tono.
//   7. calendarIntent reconoce correcciones conversacionales.
//
// La inteligencia del LLM en sí se valida con la batería en vivo
// (scripts/run-nova-battery.mjs + tests/nova-battery/cases.json) que
// requiere OPENAI_API_KEY — estos tests cubren todo lo determinista.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_EVENT_DURATIONS,
  inferDefaultDurationMinutes,
  userMentionedExplicitDuration,
  renderDurationTableForPrompt,
} from '../api/_lib/durations.js'
import {
  buildOpenAISystemPrompt,
  convertOpenAIToBackendResponse,
  NOVA_OPENAI_SCHEMA,
} from '../api/_lib/openaiNova.js'
import { buildSystemPrompt } from '../api/_lib/systemPrompt.js'
import { hasExplicitEditIntent, filterCalendarEditActions } from '../api/_lib/calendarIntent.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function action(overrides = {}) {
  return {
    type: 'create_event',
    title: 'Evento X',
    subtitle: null,
    dateText: 'hoy',
    dateISO: '2026-06-10',
    time: '17:00',
    durationMinutes: 0,
    category: 'otro',
    reminderOffsetMinutes: null,
    linkedToPreviousEvent: false,
    confidence: 'high',
    sourceText: 'evento x',
    targetEventId: null,
    memoryKey: null,
    memoryValue: null,
    memoryCategory: null,
    ...overrides,
  }
}

function payload(actions, extra = {}) {
  return {
    actions,
    needsClarification: false,
    clarificationQuestion: null,
    userConfirmationText: 'Listo.',
    ...extra,
  }
}

const KNOWN_EVENTS = [
  { id: 'ev-futbol', title: 'Fútbol', time: '5:00 PM', date: '2026-06-10' },
  { id: 'ev-dentista', title: 'Dentista', time: '11:00 AM', date: '2026-06-11' },
]

function convert(actions, { userMessage, events = KNOWN_EVENTS, history = [] } = {}) {
  return convertOpenAIToBackendResponse({
    openaiPayload: payload(actions),
    userMessage,
    history,
    reqId: 'qa-closure',
    events,
  })
}

// ─── 1. Duraciones centralizadas ────────────────────────────────────────────

test('duración por tipo: fútbol/partido → 90 min', () => {
  assert.equal(inferDefaultDurationMinutes('Fútbol'), 90)
  assert.equal(inferDefaultDurationMinutes('partido con los cabros'), 90)
})

test('duración por tipo: llamada → 30 min (spec: 15-30)', () => {
  assert.equal(inferDefaultDurationMinutes('Llamada con Juan'), 30)
})

test('duración por tipo: estudiar → 60 min (spec: 45-60)', () => {
  assert.equal(inferDefaultDurationMinutes('Estudiar publicidad'), 60)
})

test('duración por tipo: gym → 60, dentista/médico → 45, clase → 90', () => {
  assert.equal(inferDefaultDurationMinutes('Gym'), 60)
  assert.equal(inferDefaultDurationMinutes('Dentista'), 45)
  assert.equal(inferDefaultDurationMinutes('psicólogo online'), 45)
  assert.equal(inferDefaultDurationMinutes('Clase de lenguaje'), 90)
})

test('duración por tipo: tipo desconocido → null (NO inventar 60)', () => {
  assert.equal(inferDefaultDurationMinutes('Buscar a Agustina'), null)
  assert.equal(inferDefaultDurationMinutes('Sacar la ropa de la lavadora'), null)
})

test('duración explícita: "por 30 minutos", "media hora", "de 5 a 7", "hasta las 9"', () => {
  assert.equal(userMentionedExplicitDuration('estudiar publicidad a las 7 por 30 minutos'), true)
  assert.equal(userMentionedExplicitDuration('dentista mañana a las 11 por media hora'), true)
  assert.equal(userMentionedExplicitDuration('fútbol de 5 a 7'), true)
  assert.equal(userMentionedExplicitDuration('entre 5 y 7 reunión'), true)
  assert.equal(userMentionedExplicitDuration('trabajar hasta las 9'), true)
  assert.equal(userMentionedExplicitDuration('leer por 45 minutos a las 8'), true)
  assert.equal(userMentionedExplicitDuration('gym mañana a las 6 por 1 hora'), true)
})

test('duración explícita: frases SIN duración → false', () => {
  assert.equal(userMentionedExplicitDuration('fútbol a las 5'), false)
  assert.equal(userMentionedExplicitDuration('dentista mañana a las 11'), false)
  assert.equal(userMentionedExplicitDuration('reunión a las 8 de mindfulness'), false)
})

test('la tabla renderizada lista todos los tipos (una línea por tipo)', () => {
  const rendered = renderDurationTableForPrompt()
  assert.equal(rendered.split('\n').length, DEFAULT_EVENT_DURATIONS.length)
  assert.ok(rendered.includes('90 min'))
})

// ─── 2. Subtítulos en el contrato OpenAI ────────────────────────────────────

test('schema: subtitle y targetEventId existen y son required (strict mode)', () => {
  const props = NOVA_OPENAI_SCHEMA.schema.properties.actions.items.properties
  assert.ok(props.subtitle, 'falta subtitle en schema')
  assert.ok(props.targetEventId, 'falta targetEventId en schema')
  const req = NOVA_OPENAI_SCHEMA.schema.properties.actions.items.required
  assert.ok(req.includes('subtitle'))
  assert.ok(req.includes('targetEventId'))
  const types = props.type.enum
  for (const t of ['create_task', 'edit_event', 'delete_event']) {
    assert.ok(types.includes(t), `falta type ${t}`)
  }
})

test('adapter: subtitle del modelo llega a event.subtitle ("Gym" + "Pierna")', () => {
  const out = convert(
    [action({ title: 'Gym', subtitle: 'Pierna', time: '06:00', dateISO: '2026-06-11', sourceText: 'gym mañana pierna' })],
    { userMessage: 'gym mañana pierna a las 6' },
  )
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].event.title, 'Gym')
  assert.equal(out.actions[0].event.subtitle, 'Pierna')
})

test('adapter: subtitle null/vacío NO agrega el campo', () => {
  const out = convert(
    [action({ title: 'Reunión con Juan', subtitle: '  ', sourceText: 'reunión con juan' })],
    { userMessage: 'reunión con Juan a las 5' },
  )
  assert.equal(out.actions[0].event.subtitle, undefined)
})

// ─── 3. create_task → add_task ──────────────────────────────────────────────

test('adapter: create_task → add_task con label limpio ("tengo que llamar al médico")', () => {
  const out = convert(
    [action({ type: 'create_task', title: 'Llamar al médico', time: null, sourceText: 'llamar al médico' })],
    { userMessage: 'tengo que llamar al médico' },
  )
  assert.equal(out.actions.length, 1, JSON.stringify(out._dropped))
  assert.equal(out.actions[0].type, 'add_task')
  assert.equal(out.actions[0].task.label, 'Llamar al médico')
  assert.equal(out.actions[0].task.priority, 'Media')
  assert.equal(out.actions[0].task.category, 'hoy')
})

// ─── 4. edit_event / delete_event ───────────────────────────────────────────

test('adapter: edit_event con id real + hora nueva → updates.time ("cámbialo a las 6")', () => {
  const out = convert(
    [action({ type: 'edit_event', title: 'Fútbol', targetEventId: 'ev-futbol', time: '18:00', dateISO: null, sourceText: 'cámbialo a las 6' })],
    { userMessage: 'cámbialo a las 6' },
  )
  assert.equal(out.actions.length, 1, JSON.stringify(out._dropped))
  assert.equal(out.actions[0].type, 'edit_event')
  assert.equal(out.actions[0].id, 'ev-futbol')
  assert.equal(out.actions[0].updates.time, '6:00 PM')
  assert.equal(out.actions[0].updates.date, undefined)
})

test('adapter: edit_event con id INVENTADO se descarta', () => {
  const out = convert(
    [action({ type: 'edit_event', title: 'Fútbol', targetEventId: 'id-falso', time: '18:00', sourceText: 'cámbialo' })],
    { userMessage: 'cámbialo a las 6' },
  )
  assert.equal(out.actions.length, 0)
  assert.ok(out._dropped.some(d => d.includes('targetEventId inválido')))
})

test('adapter: edit_event sin ningún update concreto se descarta', () => {
  const out = convert(
    [action({ type: 'edit_event', title: 'Fútbol', targetEventId: 'ev-futbol', time: null, dateISO: null, sourceText: 'cámbialo' })],
    { userMessage: 'cámbialo' },
  )
  assert.equal(out.actions.length, 0)
  assert.ok(out._dropped.some(d => d.includes('sin updates concretos')))
})

test('adapter: delete_event con id real ("borra lo de fútbol")', () => {
  const out = convert(
    [action({ type: 'delete_event', title: 'Fútbol', targetEventId: 'ev-futbol', time: null, sourceText: 'borra lo de fútbol' })],
    { userMessage: 'borra lo de fútbol' },
  )
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].type, 'delete_event')
  assert.equal(out.actions[0].id, 'ev-futbol')
})

test('adapter: edit_event con reminderOffsetMinutes → updates.reminderOffsets', () => {
  const out = convert(
    [action({ type: 'edit_event', title: 'Dentista', targetEventId: 'ev-dentista', time: null, dateISO: null, reminderOffsetMinutes: 30, sourceText: 'ponle aviso 30 min antes' })],
    { userMessage: 'ponle aviso 30 min antes al dentista' },
  )
  assert.equal(out.actions.length, 1)
  assert.deepEqual(out.actions[0].updates.reminderOffsets, [30])
})

// ─── 5. Duración → endTime en el adapter ────────────────────────────────────

test('adapter: durationMinutes 0 → endTime null (evento punto, sin 1h fantasma)', () => {
  const out = convert(
    [action({ title: 'Buscar a Agustina', time: '15:00', durationMinutes: 0, sourceText: 'buscar a agustina' })],
    { userMessage: 'buscar a la agustina tipo 3' },
  )
  assert.equal(out.actions[0].event.endTime, null)
})

test('adapter: durationMinutes 90 + 5 PM → endTime 6:30 PM', () => {
  const out = convert(
    [action({ title: 'Fútbol con amigos', time: '17:00', durationMinutes: 90, sourceText: 'fútbol' })],
    { userMessage: 'fútbol a las 5', events: [] },
  )
  assert.equal(out.actions[0].event.endTime, '6:30 PM')
})

test('adapter: reminder con hora CONSERVA time y endTime null', () => {
  const out = convert(
    [action({ type: 'create_reminder', title: 'Comprar pan', time: '18:00', durationMinutes: 0, sourceText: 'comprar pan a las 6' })],
    { userMessage: 'acuérdame comprar pan a las 6' },
  )
  assert.equal(out.actions[0].event.time, '6:00 PM')
  assert.equal(out.actions[0].event.endTime, null)
  assert.equal(out.actions[0].event.icon, 'alarm')
})

test('adapter: multi-acción pasa entera (3 actions)', () => {
  const out = convert(
    [
      action({ title: 'Clase', subtitle: null, time: '10:00', dateISO: '2026-06-11', durationMinutes: 90, sourceText: 'clase a las 10' }),
      action({ title: 'Trabajo', time: '15:00', dateISO: '2026-06-11', durationMinutes: 60, sourceText: 'trabajo a las 3' }),
      action({ type: 'create_reminder', title: 'Llamar a mi mamá', time: '21:00', dateISO: '2026-06-11', sourceText: 'llamar a mi mamá en la noche' }),
    ],
    { userMessage: 'mañana clase a las 10, trabajo a las 3 y llamar a mi mamá en la noche' },
  )
  assert.equal(out.actions.length, 3, JSON.stringify(out._dropped))
})

// ─── 6. Prompt OpenAI con contexto y reglas ─────────────────────────────────

const FULL_PROMPT = buildOpenAISystemPrompt({
  tz: 'America/Santiago',
  todayISO: '2026-06-10',
  tomorrow: '2026-06-11',
  dayAfter: '2026-06-12',
  currentTime24: '15:30',
  weekDates: { lunes: '2026-06-15', viernes: '2026-06-12' },
  memories: ['Cata es la polola del usuario'],
  events: KNOWN_EVENTS,
  tasks: [{ id: 't1', label: 'Comprar pan', done: false }],
  discussedEventIds: ['ev-futbol'],
})

test('prompt: incluye eventos, tareas y tema en discusión', () => {
  assert.ok(FULL_PROMPT.includes('id:ev-futbol'))
  assert.ok(FULL_PROMPT.includes('Comprar pan'))
  assert.ok(FULL_PROMPT.includes('EVENTOS EN DISCUSIÓN'))
})

test('prompt: incluye la tabla de duraciones centralizada y la regla anti-60', () => {
  assert.ok(FULL_PROMPT.includes(renderDurationTableForPrompt()))
  assert.ok(FULL_PROMPT.includes('durationMinutes: 0'))
  assert.ok(/JAMÁS pongas 60/.test(FULL_PROMPT))
})

test('prompt: casos canónicos de título+subtítulo del spec', () => {
  assert.ok(FULL_PROMPT.includes('"Reunión", subtitle:"Mindfulness"'))
  assert.ok(FULL_PROMPT.includes('"Fútbol", subtitle:"Llevar la pelota"'))
  assert.ok(FULL_PROMPT.includes('"Gym", subtitle:"Pierna"'))
})

test('prompt: reglas de continuidad conversacional', () => {
  assert.ok(FULL_PROMPT.includes('CONTINUIDAD CONVERSACIONAL'))
  assert.ok(FULL_PROMPT.includes('tengo dentista mañana'))
})

test('prompt: reglas de tono — ejemplos buenos y prohibidos', () => {
  assert.ok(FULL_PROMPT.includes('Me falta solo la hora'))
  assert.ok(FULL_PROMPT.includes('Intención detectada'), 'debe listar la frase prohibida')
  assert.ok(FULL_PROMPT.includes('PROHIBIDO'))
})

test('prompt: hipotéticos no crean nada ("quizás mañana vaya al gym")', () => {
  assert.ok(FULL_PROMPT.includes('quizás mañana vaya al gym'))
  assert.ok(FULL_PROMPT.includes('HIPOTÉTICOS'))
})

test('prompt: reglas de fecha (finde, próxima semana, el 15, sin fecha → hoy)', () => {
  assert.ok(FULL_PROMPT.includes('el finde'))
  assert.ok(FULL_PROMPT.includes('la próxima semana'))
  assert.ok(FULL_PROMPT.includes('SIN fecha mencionada → HOY'))
})

test('prompt: back-compat — funciona sin events/tasks/discussed (firma vieja)', () => {
  const p = buildOpenAISystemPrompt({
    tz: 'America/Santiago', todayISO: '2026-06-10', tomorrow: '2026-06-11',
    currentTime24: '09:00', weekDates: {},
  })
  assert.ok(p.includes('(sin eventos)'))
  assert.ok(p.includes('(sin tareas)'))
})

test('prompt Anthropic: usa la misma tabla central de duraciones', () => {
  const p = buildSystemPrompt({
    dateContext: {
      tz: 'America/Santiago', todayISO: '2026-06-10', tomorrow: '2026-06-11',
      dayAfter: '2026-06-12', currentTime24: '15:30', currentTime12: '3:30 PM',
      todayStr: 'miércoles, 10 de junio de 2026', weekDates: {},
    },
    weatherContext: '', contacts: [], profile: null, behavior: null,
    memories: [], events: [], tasks: [],
  })
  assert.ok(p.includes(renderDurationTableForPrompt()))
  // La hora ambigua con actividad clara NO debe bloquearse en clarification.
  assert.ok(p.includes('No te bloquees preguntando lo obvio'))
})

// ─── 7. Correcciones conversacionales (calendarIntent) ──────────────────────

test('hasExplicitEditIntent: correcciones post-creación cuentan como intención', () => {
  for (const phrase of [
    'mejor no',
    'no lo pongas',
    'cámbialo a las 6',
    'mejor mañana',
    'ponlo una hora antes',
    'borra lo de fútbol',
    'cambia el subtítulo a pierna',
    'que sea recordatorio no evento',
    'olvida lo anterior',
    'déjalo para el viernes',
  ]) {
    assert.equal(hasExplicitEditIntent(phrase), true, `falló: "${phrase}"`)
  }
})

test('hasExplicitEditIntent: frases de creación NO disparan edición', () => {
  for (const phrase of [
    'fútbol a las 5 acuérdame llevar la pelota',
    'dentista mañana a las 11',
    'reunión a las 8 de mindfulness',
    'acuérdame comprar pan en 20 minutos',
  ]) {
    assert.equal(hasExplicitEditIntent(phrase), false, `falló: "${phrase}"`)
  }
})

test('filterCalendarEditActions: deja pasar delete cuando hay "cancela eso"', () => {
  const actions = [{ type: 'delete_event', id: 'ev-futbol' }]
  const { actions: kept, stripped } = filterCalendarEditActions(actions, 'cancela eso')
  assert.equal(kept.length, 1)
  assert.equal(stripped.length, 0)
})

test('filterCalendarEditActions: strippea edit sin ninguna intención', () => {
  const actions = [{ type: 'edit_event', id: 'ev-futbol', updates: { time: '6:00 PM' } }]
  const { actions: kept, stripped } = filterCalendarEditActions(actions, 'gym mañana a las 6')
  assert.equal(kept.length, 0)
  assert.equal(stripped.length, 1)
})
