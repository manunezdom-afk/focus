import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanNovaTitle,
  normalizeNovaResponse,
  shouldRouteToSonnetFirst,
  tryParseDeterministicCalendarRequest,
} from '../api/_lib/novaIntent.js'

const DATE_CONTEXT = {
  todayISO: '2026-05-14',
  tomorrow: '2026-05-15',
  dayAfter: '2026-05-16',
  currentTime24: '14:10',
  weekDates: {
    viernes: '2026-05-15',
    sábado: '2026-05-16',
    domingo: '2026-05-17',
    lunes: '2026-05-18',
    martes: '2026-05-19',
    miércoles: '2026-05-20',
    jueves: '2026-05-21',
  },
}

const MARKETING_EVENT = {
  id: 'evt-marketing',
  title: 'Reunión de marketing',
  date: '2026-05-15',
  time: '10:00-10:45',
  description: '',
}

function normalize(raw, message = 'mañana recuérdame llamar a mi mamá a las 3', extra = {}) {
  return normalizeNovaResponse(raw, {
    message,
    dateContext: DATE_CONTEXT,
    events: extra.events ?? [],
    alreadyEscalated: extra.alreadyEscalated ?? true,
  })
}

test('limpia títulos sin guardar la frase completa del usuario', () => {
  assert.equal(cleanNovaTitle('mañana recuérdame llamar a mi mamá a las 3'), 'Llamar a mi mamá')
  assert.equal(cleanNovaTitle('acuérdate de buscar a la Agustina'), 'Buscar a Agustina')
  assert.equal(cleanNovaTitle('mañana tengo dentista a las 5'), 'Dentista')
  assert.equal(cleanNovaTitle('tengo que estudiar historia'), 'Estudiar historia')
})

test('normaliza frase simple a evento con título limpio y hora 24h', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'event',
      title: 'mañana tengo dentista a las 5',
      date: '2026-05-15',
      start_time: '5:00 PM',
      confidence: 0.92,
    }],
  }, 'mañana tengo dentista a las 5')

  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].type, 'event')
  assert.equal(out.actions[0].title, 'Dentista')
  assert.equal(out.actions[0].date, '2026-05-15')
  assert.equal(out.actions[0].start_time, '17:00')
  assert.equal(out.actions[0].end_time, null)
})

test('normaliza recordatorio puntual sin convertirlo en bloque de una hora', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'reminder',
      title: 'tipo 3 acuérdate de buscar a la Agustina',
      date: '2026-05-14',
      reminder_time: '3 PM',
      end_time: '4 PM',
      confidence: 0.9,
    }],
  }, 'tipo 3 acuérdate de buscar a la Agustina')

  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].type, 'reminder')
  assert.equal(out.actions[0].title, 'Buscar a Agustina')
  assert.equal(out.actions[0].reminder_time, '15:00')
  assert.equal(out.actions[0].end_time, null)
})

test('separa múltiples acciones en una misma frase', () => {
  const out = tryParseDeterministicCalendarRequest(
    'mañana tengo dentista a las 5, después comprar remedios y en la noche ordenar mi pieza',
    { dateContext: DATE_CONTEXT, events: [] },
  )

  assert.ok(out, 'debe parsear una frase multi-intent cotidiana')
  assert.deepEqual(out.actions.map((a) => a.type), ['event', 'reminder', 'reminder'])
  assert.equal(out.actions[0].title, 'Dentista')
  assert.equal(out.actions[0].start_time, '17:00')
  assert.equal(out.actions[1].title, 'Comprar remedios')
  assert.equal(out.actions[2].title, 'Ordenar mi pieza')
  assert.equal(out.actions[2].reminder_time, '20:00')
})

test('vincula recordatorios bajo un evento existente', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'linked_reminder',
      title: 'llevar el informe',
      target_event_id: 'evt-marketing',
      confidence: 0.94,
    }],
  }, 'para la reunión de marketing recuérdame llevar el informe', { events: [MARKETING_EVENT] })

  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].type, 'linked_reminder')
  assert.equal(out.actions[0].title, 'Llevar el informe')
  assert.equal(out.actions[0].target_event_id, 'evt-marketing')
})

test('escala a Sonnet frases largas, multi-intent o con evento existente', () => {
  assert.equal(shouldRouteToSonnetFirst('recuérdame pagar la universidad', []), false)
  assert.equal(
    shouldRouteToSonnetFirst('agéndame entrenar mañana a las 8 y después estudiar a las 10', []),
    true,
  )
  assert.equal(
    shouldRouteToSonnetFirst('para la reunión de marketing recuérdame llevar el informe', [MARKETING_EVENT]),
    true,
  )
})

test('convierte add_task legacy en recordatorio seguro y nunca devuelve tasks', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'add_task',
      task: {
        label: 'recuérdame pagar la universidad',
        dueDate: '2026-05-14',
        dueTime: null,
      },
    }],
  }, 'recuérdame pagar la universidad')

  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].type, 'reminder')
  assert.equal(out.actions[0].title, 'Pagar la universidad')
  assert.equal(out.actions.some((a) => /task/i.test(a.type)), false)
})

test('parsea prueba con recordatorio de estudio en otra fecha', () => {
  const out = tryParseDeterministicCalendarRequest(
    'el lunes tengo prueba de historia y acuérdame estudiar el domingo',
    { dateContext: DATE_CONTEXT, events: [] },
  )

  assert.ok(out)
  assert.deepEqual(out.actions.map((a) => a.type), ['event', 'reminder'])
  assert.equal(out.actions[0].title, 'Prueba de historia')
  assert.equal(out.actions[0].date, '2026-05-18')
  assert.equal(out.actions[1].title, 'Estudiar historia')
  assert.equal(out.actions[1].date, '2026-05-17')
})

test('parsea evento con recordatorio antes del evento', () => {
  const out = tryParseDeterministicCalendarRequest(
    'hoy a las 7 juntarme con la Cata y antes recuérdame comprar flores',
    { dateContext: DATE_CONTEXT, events: [] },
  )

  assert.ok(out)
  assert.deepEqual(out.actions.map((a) => a.type), ['event', 'reminder'])
  assert.equal(out.actions[0].title, 'Juntarme con la Cata')
  assert.equal(out.actions[0].start_time, '19:00')
  assert.equal(out.actions[1].title, 'Comprar flores')
  assert.equal(out.actions[1].reminder_time, '18:30')
})

test('NO le inventa hora a un recordatorio sin reminder_time cuando hay otro intent con hora', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [
      {
        type: 'event',
        title: 'Prueba de artes e ideas',
        date: '2026-05-14',
        start_time: '10:30',
        end_time: '12:00',
        confidence: 0.9,
      },
      {
        type: 'reminder',
        title: 'Avisar al profe que voy a salir de teorías de comunicación',
        date: '2026-05-14',
        reminder_time: null,
        confidence: 0.88,
      },
    ],
  }, 'tengo prueba de artes e ideas a las 10:30 acuérdame avisarle a mi profe que voy a salir de teorías de comunicación')

  assert.equal(out.actions.length, 2)
  assert.equal(out.actions[0].type, 'event')
  assert.equal(out.actions[0].start_time, '10:30')
  assert.equal(out.actions[1].type, 'reminder')
  // El bug previo dejaba reminder_time = "10:30" (robado del evento). Ahora null.
  assert.equal(out.actions[1].reminder_time, null)
})

test('respeta reminder_time:null aun cuando el mensaje menciona "mañana"', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'reminder',
      title: 'comprar pan',
      date: '2026-05-15',
      reminder_time: null,
      confidence: 0.9,
    }],
  }, 'mañana comprar pan')

  assert.equal(out.actions[0].reminder_time, null)
})

test('escala a Sonnet cuando hay verbo de evento + verbo de recordatorio sin conector', () => {
  // El caso real que reportó el usuario en mayo 2026: sin "y/después/coma"
  // de por medio, Haiku tendía a mezclar los intents.
  assert.equal(
    shouldRouteToSonnetFirst(
      'tengo prueba de artes a las 10:30 acuérdame avisar al profe',
      [],
    ),
    true,
  )
  // Solo reminder (sin verbo de evento) sigue yendo a Haiku.
  assert.equal(shouldRouteToSonnetFirst('acuérdame comprar pan', []), false)
})

test('marca como escalable una respuesta incompleta de Haiku', () => {
  const out = normalize({
    reply: 'Listo.',
    actions: [{
      type: 'reminder',
      title: 'comprar flores',
      confidence: 0.42,
    }],
  }, 'hoy a las 7 juntarme con la Cata y antes recuérdame comprar flores', {
    alreadyEscalated: false,
  })

  assert.equal(out.needsEscalation, true)
  assert.ok(out.issues.includes('low_confidence'))
})
