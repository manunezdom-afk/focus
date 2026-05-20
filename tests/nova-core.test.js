// Tests del orquestador Nova Core: router + validator + localParser + core
// (con OpenAI mockeado). NO llama a OpenAI real — usamos un fetch fake.
//
// Cubre lo que el usuario pidió en la spec:
//  - "qué tengo hoy" → 0 LLM calls (localParser)
//  - input simple → cheap
//  - input multi-acción → strong directo
//  - cheap → strong cuando validator falla
//  - validator bloquea títulos basura, contaminación, fechas incorrectas
//  - Kairos/Spark adapters NO migrados (stubs)

import assert from 'node:assert/strict'
import test from 'node:test'

import { decideRoute } from '../api/_lib/nova/router.js'
import { tryLocalParse } from '../api/_lib/nova/localParser.js'
import {
  validateSemanticActions,
  shouldRetryWithStrong,
  resolveCorrectionConflicts,
  inputHasCorrection,
} from '../api/_lib/nova/validator.js'
import {
  expandToSemanticActions,
  collapseSemanticToBackendActions,
  buildOpenAISystemPrompt as buildFocusPrompt,
} from '../api/_lib/nova/adapters/focus.js'
import { runNova } from '../api/_lib/nova/core.js'
import { notImplemented as kairosNotImplemented } from '../api/_lib/nova/adapters/kairos.js'
import { notImplemented as sparkNotImplemented } from '../api/_lib/nova/adapters/spark.js'

// ─── localParser ────────────────────────────────────────────────────────────

test('localParser: "qué tengo hoy" → review_today sin LLM', () => {
  const r = tryLocalParse('qué tengo hoy')
  assert.ok(r, 'debería matchear')
  assert.equal(r.intent, 'review_today')
  assert.equal(r.actions[0].type, 'review_today')
})

test('localParser: variantes hoy', () => {
  assert.ok(tryLocalParse('que tengo hoy'))
  assert.ok(tryLocalParse('Muéstrame mi día'))
  assert.ok(tryLocalParse('agenda de hoy'))
  assert.ok(tryLocalParse('Hoy?'))
})

test('localParser: "qué tengo mañana" → review_pending', () => {
  const r = tryLocalParse('qué tengo mañana')
  assert.ok(r)
  assert.equal(r.intent, 'review_pending')
  assert.equal(r.actions[0].when, 'tomorrow')
})

test('localParser: saludo → chat_only', () => {
  const r = tryLocalParse('hola')
  assert.ok(r)
  assert.equal(r.intent, 'chat')
})

test('localParser: input concreto → null (delega a LLM)', () => {
  assert.equal(tryLocalParse('mañana entregar trabajo a las ocho 30'), null)
  assert.equal(tryLocalParse('recuérdame llamar a mi mamá a las 6'), null)
})

// ─── router ─────────────────────────────────────────────────────────────────

test('router: "qué tengo hoy" → local', () => {
  const r = decideRoute({ message: 'qué tengo hoy' })
  assert.equal(r.route, 'local')
  assert.ok(r.reason.startsWith('localParser:'))
})

test('router: input simple → cheap', () => {
  const r = decideRoute({ message: 'mañana doctor a las 5' })
  assert.equal(r.route, 'cheap')
  assert.equal(r.reason, 'simple-default')
})

test('router: multi-acción con "y recuérdame" → strong', () => {
  const r = decideRoute({ message: 'mañana doctor a las 5 y recuérdame llevar exámenes' })
  assert.equal(r.route, 'strong')
  assert.ok(r.reason.startsWith('strong-hint:'))
})

test('router: corrección "no no mejor" → strong', () => {
  const r = decideRoute({ message: 'mañana fútbol a las 4, no no mejor a las 5' })
  assert.equal(r.route, 'strong')
  assert.ok(r.reason.startsWith('correction-hint:'))
})

test('router: linked-reminder trigger (llevar) con verbo evento → strong', () => {
  const r = decideRoute({ message: 'tengo fútbol a las 4 llevar zapatos' })
  assert.equal(r.route, 'strong')
  assert.ok(r.reason.startsWith('linked-reminder:'))
})

test('router: input largo → strong', () => {
  const long = 'a'.repeat(200)
  const r = decideRoute({ message: long })
  assert.equal(r.route, 'strong')
  assert.equal(r.reason, 'long-input')
})

// ─── validator ──────────────────────────────────────────────────────────────

test('validator: títulos basura son fatales', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Horas', sourceText: 'a las 5', confidence: 'high', dateISO: '2026-05-19' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'a las 5 algo', todayISO: '2026-05-19', tomorrowISO: '2026-05-20' })
  assert.equal(r.valid, false)
  assert.equal(r.fatal, true)
  assert.ok(r.errors[0].includes('basura'))
})

test('validator: "Reunión" pelado se rechaza', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Reunión', sourceText: 'reunión', confidence: 'high' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'mañana reunión' })
  assert.equal(r.valid, false)
  assert.ok(r.errors[0].includes('genérico'))
})

test('validator: sourceText ausente → error', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Doctor', sourceText: '', confidence: 'high' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'tengo doctor a las 5' })
  assert.equal(r.valid, false)
})

test('validator: "hoy" en input pero dateISO ≠ todayISO → error', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Doctor', sourceText: 'doctor', dateISO: '2026-05-22', confidence: 'high' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'hoy doctor', todayISO: '2026-05-19', tomorrowISO: '2026-05-20' })
  assert.equal(r.valid, false)
  assert.ok(r.errors.some(e => e.includes('no es hoy')))
})

test('validator: linked sin parent existente → error', () => {
  const actions = [
    { type: 'create_linked_reminder', id: 'l1', parentActionId: 'evt-9', offsetMinutes: 20, text: 'Salir 20 min antes', confidence: 'high' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'cualquier cosa' })
  assert.equal(r.valid, false)
  assert.ok(r.errors[0].includes('sin parent'))
})

test('validator: acciones válidas pasan', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Fútbol', sourceText: 'fútbol', dateISO: '2026-05-19', confidence: 'high' },
    { type: 'create_linked_reminder', id: 'l1', parentActionId: 'a1', offsetMinutes: 20, text: 'Salir 20 min antes', confidence: 'high' },
  ]
  const r = validateSemanticActions(actions, { userMessage: 'hoy fútbol salir 20 min antes', todayISO: '2026-05-19' })
  assert.equal(r.valid, true)
  assert.equal(r.errors.length, 0)
})

test('shouldRetryWithStrong: basura/contaminación → retry', () => {
  assert.equal(shouldRetryWithStrong(['title basura: "Horas"']), true)
  assert.equal(shouldRetryWithStrong(['contaminación: ...']), true)
  assert.equal(shouldRetryWithStrong(['dateISO 2020-01-01 no es hoy (2026-05-19) para "X"']), true)
})

test('shouldRetryWithStrong: errores estructurales → NO retry', () => {
  assert.equal(shouldRetryWithStrong(['type desconocido: foo']), false)
  assert.equal(shouldRetryWithStrong([]), false)
})

// ─── expand / collapse: round-trip semántico ────────────────────────────────

test('expand→collapse: fútbol con 2 linkedReminders → 1 evento iOS con arrays paralelos', () => {
  const raw = [
    {
      type: 'create_event',
      title: 'Fútbol',
      dateISO: '2026-05-19',
      time: '16:00',
      durationMinutes: 60,
      category: 'personal',
      reminderOffsetMinutes: null,
      sourceText: 'fútbol hoy a las 4',
      confidence: 'high',
      linkedReminders: [
        { kind: 'offset_action', offsetMinutes: 20, text: 'Salir 20 min antes' },
        { kind: 'checklist_note', offsetMinutes: null, text: 'Llevar zapatos de fútbol' },
      ],
    },
  ]
  const semantic = expandToSemanticActions(raw)
  // 1 create_event + 1 create_linked_reminder + 1 create_linked_sub_reminder
  assert.equal(semantic.length, 3)
  assert.equal(semantic[0].type, 'create_event')
  assert.equal(semantic[1].type, 'create_linked_reminder')
  assert.equal(semantic[1].offsetMinutes, 20)
  assert.equal(semantic[2].type, 'create_linked_sub_reminder')
  assert.equal(semantic[2].offsetMinutes, 20) // heredó del offset_action

  const { safeActions } = collapseSemanticToBackendActions(semantic, {
    inputMessage: 'tengo fútbol hoy a las 4, acuérdame salir 20 min antes y llevar zapatos de fútbol',
    reqId: 'r1',
  })
  assert.equal(safeActions.length, 1)
  assert.equal(safeActions[0].event.title, 'Fútbol')
  assert.deepEqual(safeActions[0].event.reminderOffsets, [20, 20])
  assert.deepEqual(safeActions[0].event.reminderNotes, ['Salir 20 min antes', 'Llevar zapatos de fútbol'])
})

// ─── core con OpenAI mockeado ───────────────────────────────────────────────

function mockOpenAIResponse(actions, opts = {}) {
  return {
    output_text: JSON.stringify({
      actions,
      needsClarification: opts.needsClarification || false,
      clarificationQuestion: opts.clarificationQuestion || null,
      userConfirmationText: opts.userConfirmationText || 'Listo.',
    }),
    usage: { input_tokens: 100, output_tokens: 50 },
    model: opts.model || 'mock-model',
  }
}

/**
 * Mocks global.fetch para que callOpenAI devuelva la respuesta dada.
 * Devuelve una función `restore` para limpiar.
 */
function mockFetch(handler) {
  const original = global.fetch
  let calls = 0
  global.fetch = async (...args) => {
    calls += 1
    const response = await handler(args, calls)
    return {
      ok: response.ok ?? true,
      status: response.status || 200,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body || {}),
    }
  }
  return {
    restore: () => { global.fetch = original },
    getCalls: () => calls,
  }
}

const FAKE_DATE_CONTEXT = {
  tz: 'America/Santiago',
  todayISO: '2026-05-19',
  tomorrow: '2026-05-20',
  currentTime24: '09:00',
  weekDates: {},
}

test('core: "qué tengo hoy" usa local parser, 0 OpenAI calls', async () => {
  const fetchMock = mockFetch(() => ({ ok: true, body: {} }))
  try {
    const result = await runNova({
      app: 'focus',
      message: 'qué tengo hoy',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r1',
      apiKey: 'fake-key',
    })
    assert.equal(fetchMock.getCalls(), 0, 'NO debe llamar OpenAI')
    assert.equal(result._nova.modelUsed, null)
    assert.equal(result._nova.intent, 'review_today')
    assert.equal(result.mode, 'chat_only')
    assert.equal(result.actions.length, 0) // review_today no genera BackendAction
  } finally {
    fetchMock.restore()
  }
})

test('core: input simple → cheap, sin fallback', async () => {
  const fetchMock = mockFetch(([url, init], n) => {
    const body = JSON.parse(init.body)
    assert.match(body.model, /mini|cheap|5\.4/, `esperaba cheap, fue ${body.model}`)
    return {
      ok: true,
      body: mockOpenAIResponse([{
        type: 'create_event', title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20',
        time: '17:00', durationMinutes: 60, category: 'salud',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'doctor a las 5', linkedReminders: [],
      }], { model: 'gpt-5.4-mini' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana doctor a las 5',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-cheap',
      apiKey: 'fake-key',
    })
    assert.equal(fetchMock.getCalls(), 1)
    assert.equal(result._nova.fallbackUsed, false)
    assert.equal(result._nova.routingReason, 'simple-default')
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.title, 'Doctor')
  } finally {
    fetchMock.restore()
  }
})

test('core: multi-acción "y recuérdame" → strong directo', async () => {
  const fetchMock = mockFetch(([url, init]) => {
    const body = JSON.parse(init.body)
    assert.match(body.model, /5\.5|strong/, `esperaba strong, fue ${body.model}`)
    return {
      ok: true,
      body: mockOpenAIResponse([
        {
          type: 'create_event', title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20',
          time: '17:00', durationMinutes: 60, category: 'salud',
          reminderOffsetMinutes: null, linkedToPreviousEvent: false,
          confidence: 'high', sourceText: 'doctor a las 5',
          linkedReminders: [
            { kind: 'checklist_note', offsetMinutes: null, text: 'Llevar los exámenes' },
          ],
        },
      ], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana tengo doctor a las 5 y recuérdame llevar los exámenes',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-strong',
      apiKey: 'fake-key',
    })
    assert.equal(fetchMock.getCalls(), 1)
    assert.ok(result._nova.routingReason.startsWith('strong-hint:'))
    assert.equal(result._nova.fallbackUsed, false)
    assert.equal(result.actions.length, 1)
    assert.deepEqual(result.actions[0].event.reminderNotes, ['Llevar los exámenes'])
  } finally {
    fetchMock.restore()
  }
})

test('core: cheap devuelve título basura → fallback a strong', async () => {
  const fetchMock = mockFetch(([url, init], n) => {
    const body = JSON.parse(init.body)
    if (n === 1) {
      // Cheap responde con basura
      return {
        ok: true,
        body: mockOpenAIResponse([{
          type: 'create_event', title: 'Horas', dateText: 'hoy', dateISO: '2026-05-19',
          time: '16:00', durationMinutes: 60, category: 'otro',
          reminderOffsetMinutes: null, linkedToPreviousEvent: false,
          confidence: 'high', sourceText: 'a las 4',
          linkedReminders: [],
        }], { model: 'gpt-5.4-mini' }),
      }
    }
    // Strong responde con título limpio
    return {
      ok: true,
      body: mockOpenAIResponse([{
        type: 'create_event', title: 'Desayuno con Marcia', dateText: 'hoy', dateISO: '2026-05-19',
        time: '16:00', durationMinutes: 60, category: 'reunion',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'desayuno con Marcia',
        linkedReminders: [],
      }], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'hoy a las 4 desayuno con Marcia',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-fallback',
      apiKey: 'fake-key',
    })
    assert.equal(fetchMock.getCalls(), 2, 'cheap + strong = 2')
    assert.equal(result._nova.fallbackUsed, true)
    assert.ok(result._nova.routingReason.includes('fallback:validator'))
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.title, 'Desayuno con Marcia')
  } finally {
    fetchMock.restore()
  }
})

test('core: cheap 404 (modelo inexistente) → fallback a strong sin error', async () => {
  const fetchMock = mockFetch(([url, init], n) => {
    if (n === 1) return { ok: false, status: 404, body: { error: 'model not found' } }
    return {
      ok: true,
      body: mockOpenAIResponse([{
        type: 'create_event', title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20',
        time: '17:00', durationMinutes: 60, category: 'salud',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'doctor a las 5',
        linkedReminders: [],
      }], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana doctor a las 5',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-404',
      apiKey: 'fake-key',
    })
    assert.equal(fetchMock.getCalls(), 2)
    assert.equal(result._nova.fallbackUsed, true)
    assert.ok(result._nova.routingReason.includes('fallback:cheap-404'))
    assert.equal(result.actions.length, 1)
  } finally {
    fetchMock.restore()
  }
})

test('core: routingEnabled=false → todo va a strong directo', async () => {
  const fetchMock = mockFetch(([url, init]) => {
    const body = JSON.parse(init.body)
    assert.match(body.model, /5\.5|strong/)
    return {
      ok: true,
      body: mockOpenAIResponse([{
        type: 'create_event', title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20',
        time: '17:00', durationMinutes: 60, category: 'salud',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'doctor', linkedReminders: [],
      }], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana doctor a las 5',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-no-routing',
      apiKey: 'fake-key',
      routingEnabled: false,
    })
    assert.equal(result._nova.routingReason, 'routing-disabled')
    assert.equal(fetchMock.getCalls(), 1)
  } finally {
    fetchMock.restore()
  }
})

test('core: app="kairos" → 501', async () => {
  await assert.rejects(
    () => runNova({
      app: 'kairos',
      message: 'cualquier cosa',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-k',
      apiKey: 'fake-key',
    }),
    err => err.status === 501,
  )
})

test('core: app="spark" → 501', async () => {
  await assert.rejects(
    () => runNova({
      app: 'spark',
      message: 'cualquier cosa',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'r-s',
      apiKey: 'fake-key',
    }),
    err => err.status === 501,
  )
})

// ─── Adapters stub ─────────────────────────────────────────────────────────

test('KairosNovaAdapter: notImplemented tira 501', () => {
  assert.throws(() => kairosNotImplemented(), err => err.status === 501 && err.code === 'kairos_adapter_not_implemented')
})

test('SparkNovaAdapter: notImplemented tira 501', () => {
  assert.throws(() => sparkNotImplemented(), err => err.status === 501 && err.code === 'spark_adapter_not_implemented')
})

// ─── Correcciones humanas (intent normalization) ───────────────────────────

test('inputHasCorrection: detecta triggers comunes', () => {
  assert.equal(inputHasCorrection('mañana fútbol a las 4, no no mejor a las 5'), true)
  assert.equal(inputHasCorrection('espera mejor a las 7'), true)
  assert.equal(inputHasCorrection('hoy a las 4, no perdón, mañana'), true)
  assert.equal(inputHasCorrection('me equivoqué, es mañana'), true)
  assert.equal(inputHasCorrection('cámbialo a las 6'), true)
  assert.equal(inputHasCorrection('olvida eso, mejor el viernes'), true)
})

test('inputHasCorrection: no false positives en frases normales', () => {
  assert.equal(inputHasCorrection('mañana doctor a las 5'), false)
  assert.equal(inputHasCorrection('recuérdame llamar a mi mamá a las 6'), false)
  assert.equal(inputHasCorrection('tengo fútbol y luego estudiar'), false)
})

test('resolveCorrectionConflicts: input SIN trigger → actions intactas', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Fútbol', time: '4:00 PM', dateISO: '2026-05-20' },
    { type: 'create_event', id: 'a2', title: 'Fútbol', time: '5:00 PM', dateISO: '2026-05-20' },
  ]
  const r = resolveCorrectionConflicts(actions, { userMessage: 'fútbol a las 4 y estudiar a las 5' })
  assert.equal(r.conflicts, 0)
  assert.equal(r.resolved.length, 2)
})

test('resolveCorrectionConflicts: con "no no mejor" y duplicado → mantiene el último', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Fútbol', time: '4:00 PM', dateISO: '2026-05-20' },
    { type: 'create_event', id: 'a2', title: 'Fútbol', time: '5:00 PM', dateISO: '2026-05-20' },
  ]
  const r = resolveCorrectionConflicts(actions, { userMessage: 'mañana fútbol a las 4, no no mejor a las 5' })
  assert.equal(r.conflicts, 1)
  assert.equal(r.resolved.length, 1)
  assert.equal(r.resolved[0].id, 'a2')
  assert.equal(r.resolved[0].time, '5:00 PM')
})

test('resolveCorrectionConflicts: "perdón mañana" cambia fecha → mantiene la última', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Desayuno con Marcia', time: '4:00 PM', dateISO: '2026-05-19' },
    { type: 'create_event', id: 'a2', title: 'Desayuno con Marcia', time: '4:00 PM', dateISO: '2026-05-20' },
  ]
  const r = resolveCorrectionConflicts(actions, { userMessage: 'hoy a las 4 desayuno con Marcia, no perdón, mañana' })
  assert.equal(r.conflicts, 1)
  assert.equal(r.resolved[0].dateISO, '2026-05-20')
})

test('resolveCorrectionConflicts: linked-reminders huérfanos se descartan', () => {
  const actions = [
    { type: 'create_event', id: 'evt-1', title: 'Doctor', time: '5:00 PM', dateISO: '2026-05-20' },
    { type: 'create_linked_sub_reminder', id: 'ls-1', parentActionId: 'evt-1', text: 'Llevar exámenes', offsetMinutes: 0 },
    { type: 'create_event', id: 'evt-2', title: 'Doctor', time: '5:30 PM', dateISO: '2026-05-20' },
    { type: 'create_linked_sub_reminder', id: 'ls-2', parentActionId: 'evt-2', text: 'Llevar la receta', offsetMinutes: 0 },
  ]
  const r = resolveCorrectionConflicts(actions, { userMessage: 'doctor a las 5, no mejor 5:30, y llevar receta' })
  assert.equal(r.conflicts, 1)
  // sobrevive evt-2 + ls-2
  assert.equal(r.resolved.length, 2)
  assert.equal(r.resolved[0].id, 'evt-2')
  assert.equal(r.resolved[1].id, 'ls-2')
  // ls-1 fue huérfano
  assert.ok(r.removed.some(d => d.id === 'ls-1'))
})

test('resolveCorrectionConflicts: 2 eventos distintos NO se mezclan', () => {
  const actions = [
    { type: 'create_event', id: 'a1', title: 'Gimnasio', time: '5:00 PM', dateISO: '2026-05-19' },
    { type: 'create_event', id: 'a2', title: 'Estudiar', time: '8:00 PM', dateISO: '2026-05-20' },
  ]
  const r = resolveCorrectionConflicts(actions, { userMessage: 'hoy 5 gimnasio y 8 estudiar, no, estudiar mañana' })
  // Stem distintos (gimnasio/estudiar) → no se mezclan
  assert.equal(r.conflicts, 0)
  assert.equal(r.resolved.length, 2)
})

// ─── 10 casos canónicos del usuario — propagation via core + mock LLM ──────

test('caso correcciones 1: fútbol a las 4, no no mejor a las 5 → 1 evento 17:00', async () => {
  const fetchMock = mockFetch(() => ({
    ok: true,
    body: mockOpenAIResponse([
      {
        type: 'create_event', title: 'Fútbol', dateText: 'mañana', dateISO: '2026-05-20',
        time: '17:00', durationMinutes: 60, category: 'personal',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'fútbol a las 4', linkedReminders: [],
        supersedesPrevious: true, finalIntentText: 'a las 5',
      },
    ], { model: 'gpt-5.5' }),
  }))
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana tengo fútbol a las 4, no no mejor a las 5',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr1',
      apiKey: 'fake-key',
    })
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.title, 'Fútbol')
    assert.equal(result.actions[0].event.time, '5:00 PM')
  } finally {
    fetchMock.restore()
  }
})

test('caso correcciones 2: el normalizer reescribe el input ANTES de mandarlo al LLM', async () => {
  let receivedInput = null
  const fetchMock = mockFetch(([url, init]) => {
    const body = JSON.parse(init.body)
    // El segundo mensaje (user) debe ser el input NORMALIZADO sin "no no mejor a las 5".
    receivedInput = body.input.find(m => m.role === 'user')?.content
    return {
      ok: true,
      body: mockOpenAIResponse([
        {
          type: 'create_event', title: 'Fútbol', dateText: 'mañana', dateISO: '2026-05-20',
          time: '17:00', durationMinutes: 60, category: 'personal',
          reminderOffsetMinutes: null, linkedToPreviousEvent: false,
          confidence: 'high', sourceText: 'fútbol a las 5', linkedReminders: [],
          supersedesPrevious: false, finalIntentText: null,
        },
      ], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana tengo fútbol a las 4, no no mejor a las 5',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr2',
      apiKey: 'fake-key',
    })
    // El normalizer pre-LLM eliminó "no no mejor a las 5" → "a las 5"
    assert.ok(receivedInput.includes('a las 5'), `LLM received: ${receivedInput}`)
    assert.ok(!receivedInput.includes('no no'), `LLM still has "no no": ${receivedInput}`)
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.time, '5:00 PM')
  } finally {
    fetchMock.restore()
  }
})

test('caso correcciones 3: llamar mamá a las 6, espera mejor a las 7 → 19:00', async () => {
  const fetchMock = mockFetch(() => ({
    ok: true,
    body: mockOpenAIResponse([
      {
        type: 'create_reminder', title: 'Llamar a mi mamá', dateText: 'hoy', dateISO: '2026-05-19',
        time: '19:00', durationMinutes: 0, category: 'otro',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'llamar a mi mamá a las 7', linkedReminders: [],
        supersedesPrevious: true, finalIntentText: 'a las 7',
      },
    ], { model: 'gpt-5.5' }),
  }))
  try {
    const result = await runNova({
      app: 'focus',
      message: 'recuérdame llamar a mi mamá a las 6, espera mejor a las 7',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr3',
      apiKey: 'fake-key',
    })
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.title, 'Llamar a mi mamá')
  } finally {
    fetchMock.restore()
  }
})

test('caso correcciones 4: desayuno con Marcia hoy, no perdón mañana → normalizer reescribe a "mañana"', async () => {
  let receivedInput = null
  const fetchMock = mockFetch(([url, init]) => {
    const body = JSON.parse(init.body)
    receivedInput = body.input.find(m => m.role === 'user')?.content
    return {
      ok: true,
      body: mockOpenAIResponse([
        {
          type: 'create_event', title: 'Desayuno con Marcia', dateText: 'mañana', dateISO: '2026-05-20',
          time: '16:00', durationMinutes: 60, category: 'reunion',
          reminderOffsetMinutes: null, linkedToPreviousEvent: false,
          confidence: 'high', sourceText: 'desayuno con Marcia', linkedReminders: [],
          supersedesPrevious: false, finalIntentText: null,
        },
      ], { model: 'gpt-5.5' }),
    }
  })
  try {
    const result = await runNova({
      app: 'focus',
      message: 'hoy a las 4 desayuno con Marcia, no perdón, mañana',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr4',
      apiKey: 'fake-key',
    })
    // El normalizer reescribió "hoy ... no perdón, mañana" → "mañana ..."
    assert.ok(receivedInput.includes('mañana'), `LLM received: ${receivedInput}`)
    assert.ok(!receivedInput.includes('no perdón'), `LLM still has "no perdón": ${receivedInput}`)
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.date, '2026-05-20')
  } finally {
    fetchMock.restore()
  }
})

test('caso correcciones 5: doctor + recuérdame exámenes, no mejor receta → solo receta', async () => {
  const fetchMock = mockFetch(() => ({
    ok: true,
    body: mockOpenAIResponse([
      {
        type: 'create_event', title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20',
        time: '17:00', durationMinutes: 60, category: 'salud',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'doctor a las 5', linkedReminders: [
          { kind: 'checklist_note', offsetMinutes: null, text: 'Llevar la receta' },
        ],
        supersedesPrevious: true, finalIntentText: 'mejor llevar la receta',
      },
    ], { model: 'gpt-5.5' }),
  }))
  try {
    const result = await runNova({
      app: 'focus',
      message: 'mañana doctor a las 5 y recuérdame llevar exámenes, no, mejor llevar la receta',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr5',
      apiKey: 'fake-key',
    })
    assert.equal(result.actions.length, 1)
    assert.equal(result.actions[0].event.title, 'Doctor')
    assert.deepEqual(result.actions[0].event.reminderNotes, ['Llevar la receta'])
  } finally {
    fetchMock.restore()
  }
})

test('caso correcciones 6: gimnasio hoy + estudiar, no estudiar mañana → 2 events distintos', async () => {
  const fetchMock = mockFetch(() => ({
    ok: true,
    body: mockOpenAIResponse([
      {
        type: 'create_event', title: 'Gimnasio', dateText: 'hoy', dateISO: '2026-05-19',
        time: '17:00', durationMinutes: 60, category: 'personal',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'gimnasio a las 5', linkedReminders: [],
        supersedesPrevious: false, finalIntentText: null,
      },
      {
        type: 'create_event', title: 'Estudiar', dateText: 'mañana', dateISO: '2026-05-20',
        time: '20:00', durationMinutes: 60, category: 'estudio',
        reminderOffsetMinutes: null, linkedToPreviousEvent: false,
        confidence: 'high', sourceText: 'estudiar mañana', linkedReminders: [],
        supersedesPrevious: true, finalIntentText: 'estudiar mañana',
      },
    ], { model: 'gpt-5.5' }),
  }))
  try {
    const result = await runNova({
      app: 'focus',
      message: 'hoy a las 5 gimnasio y a las 8 estudiar, no, estudiar mañana',
      dateContext: FAKE_DATE_CONTEXT,
      reqId: 'corr6',
      apiKey: 'fake-key',
    })
    // Gimnasio y Estudiar tienen stems distintos — no se colapsan.
    assert.equal(result.actions.length, 2)
    assert.equal(result.actions[0].event.title, 'Gimnasio')
    assert.equal(result.actions[1].event.title, 'Estudiar')
    assert.equal(result.actions[1].event.date, '2026-05-20')
  } finally {
    fetchMock.restore()
  }
})

test('system prompt contiene regla 11 de correcciones humanas con ejemplos', () => {
  const p = buildFocusPrompt({
    tz: 'America/Santiago', todayISO: '2026-05-19', tomorrow: '2026-05-20',
    currentTime24: '09:00', weekDates: {},
  })
  assert.ok(p.includes('CORRECCIONES HUMANAS'), 'debe tener sección CORRECCIONES HUMANAS')
  assert.ok(p.includes('no no'), 'trigger "no no"')
  assert.ok(p.includes('perdón'), 'trigger perdón')
  assert.ok(p.includes('supersedesPrevious'), 'debe enseñar el campo supersedesPrevious')
  assert.ok(p.includes('finalIntentText'), 'debe enseñar el campo finalIntentText')
})
