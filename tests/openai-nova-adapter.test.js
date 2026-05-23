// Tests unitarios del adapter OpenAI → BackendAction (`openaiNova.js`).
//
// Estos tests son CRÍTICOS para el QA del provider OpenAI: garantizan que
// la conversión del contrato OpenAI al shape que el cliente iOS conoce
// funciona para los 8 casos del QA matrix, Y que las defensas
// anti-basura/anti-contaminación bloquean los outputs malos antes de
// llegar al cliente.
//
// NO llamamos a OpenAI real — usamos respuestas raw simuladas para
// aislar el adapter de la red.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  convertOpenAIToBackendResponse,
  NOVA_OPENAI_SCHEMA,
  buildOpenAISystemPrompt,
} from '../api/_lib/openaiNova.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fakeOpenAIPayload({ actions = [], needsClarification = false, clarificationQuestion = null, userConfirmationText = '' }) {
  return { actions, needsClarification, clarificationQuestion, userConfirmationText }
}

function event({ title, dateText = 'hoy', dateISO = '2026-05-19', time = null, durationMinutes = 60, category = 'otro', reminderOffsetMinutes = null, confidence = 'high', sourceText }) {
  return {
    type: 'create_event',
    title,
    dateText,
    dateISO,
    time,
    durationMinutes,
    category,
    reminderOffsetMinutes,
    linkedToPreviousEvent: false,
    confidence,
    sourceText: sourceText ?? title,
  }
}

function reminder({ title, dateText = 'hoy', dateISO = '2026-05-19', time = null, confidence = 'high', sourceText }) {
  return {
    type: 'create_reminder',
    title,
    dateText,
    dateISO,
    time,
    durationMinutes: 0,
    category: 'otro',
    reminderOffsetMinutes: null,
    linkedToPreviousEvent: false,
    confidence,
    sourceText: sourceText ?? title,
  }
}

// ─── Schema sanity ──────────────────────────────────────────────────────────

test('schema export tiene shape esperada para Structured Outputs', () => {
  assert.equal(NOVA_OPENAI_SCHEMA.name, 'nova_actions')
  assert.equal(NOVA_OPENAI_SCHEMA.strict, true)
  assert.equal(NOVA_OPENAI_SCHEMA.schema.type, 'object')
  assert.ok(NOVA_OPENAI_SCHEMA.schema.required.includes('actions'))
})

test('system prompt incluye la zona horaria y fechas del contexto', () => {
  const p = buildOpenAISystemPrompt({
    tz: 'America/Santiago', todayISO: '2026-05-19', tomorrow: '2026-05-20',
    currentTime24: '15:30', weekDates: { lunes: '2026-05-19' },
  })
  assert.ok(p.includes('America/Santiago'))
  assert.ok(p.includes('2026-05-19'))
  assert.ok(p.includes('2026-05-20'))
  assert.ok(p.includes('15:30'))
})

// ─── QA case 1: "mañana entregar trabajo a las ocho 30 del Master" ──────────

test('caso 1: "mañana entregar trabajo a las ocho 30 del Master" → 1 event 08:30', () => {
  const payload = fakeOpenAIPayload({
    actions: [event({
      title: 'Entregar trabajo del Master',
      dateText: 'mañana',
      dateISO: '2026-05-20',
      time: '08:30',
      category: 'universidad',
      sourceText: 'entregar trabajo a las ocho 30 del Master',
    })],
    userConfirmationText: 'Listo, agendé Entregar trabajo del Master mañana a las 8:30 AM.',
  })
  const out = convertOpenAIToBackendResponse({
    openaiPayload: payload,
    userMessage: 'mañana entregar trabajo a las ocho 30 del Master',
    reqId: 'r1',
  })
  assert.equal(out.actions.length, 1, JSON.stringify(out._dropped))
  assert.equal(out.actions[0].type, 'add_event')
  assert.equal(out.actions[0].event.title, 'Entregar trabajo del Master')
  assert.equal(out.actions[0].event.time, '8:30 AM')
  assert.equal(out.actions[0].event.date, '2026-05-20')
  assert.equal(out.actions[0].event.icon, 'menu_book')
  assert.equal(out.requestId, 'r1')
})

// ─── QA case 2: misma frase pero con "8:30" en dígitos ─────────────────────

test('caso 2: "mañana entregar trabajo a las 8:30 del Master" → 1 event 08:30', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({
        title: 'Entregar trabajo del Master',
        dateText: 'mañana',
        dateISO: '2026-05-20',
        time: '08:30',
        category: 'universidad',
        sourceText: 'entregar trabajo a las 8:30',
      })],
      userConfirmationText: '',
    }),
    userMessage: 'mañana entregar trabajo a las 8:30 del Master',
    reqId: 'r2',
  })
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].event.title, 'Entregar trabajo del Master')
  assert.equal(out.actions[0].event.time, '8:30 AM')
})

// ─── QA case 3: "hoy a las 4 desayuno con Marcia" — NUNCA "Horas" ──────────

test('caso 3: "hoy a las 4 desayuno con Marcia" → 1 event 16:00, title no es "Horas"', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({
        title: 'Desayuno con Marcia',
        dateText: 'hoy',
        dateISO: '2026-05-19',
        time: '16:00',
        category: 'reunion',
        sourceText: 'desayuno con Marcia',
      })],
    }),
    userMessage: 'hoy a las 4 desayuno con Marcia',
    reqId: 'r3',
  })
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].event.title, 'Desayuno con Marcia')
  assert.equal(out.actions[0].event.time, '4:00 PM')
  assert.equal(out.actions[0].event.icon, 'groups')
})

test('caso 3-defensa: si el modelo emite título "Horas", el adapter lo descarta', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({
        title: 'Horas',
        time: '16:00',
        sourceText: 'a las 4',
      })],
    }),
    userMessage: 'hoy a las 4 desayuno con Marcia',
    reqId: 'r3b',
  })
  assert.equal(out.actions.length, 0)
  assert.ok(out._dropped[0].includes('basura'))
})

// ─── QA case 4: "mañana tengo doctor a las 5 y recuérdame llevar exámenes" ──

test('caso 4: doctor + recordatorio sin hora → 1 add_event + 1 add_task', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        event({
          title: 'Doctor',
          dateText: 'mañana',
          dateISO: '2026-05-20',
          time: '17:00',
          category: 'salud',
          sourceText: 'doctor a las 5',
        }),
        reminder({
          title: 'Llevar los exámenes',
          dateText: 'mañana',
          dateISO: '2026-05-20',
          time: null,
          sourceText: 'recuérdame llevar los exámenes',
        }),
      ],
      userConfirmationText: 'Listo, agendé Doctor mañana a las 5 PM y un recordatorio para llevar los exámenes.',
    }),
    userMessage: 'mañana tengo doctor a las 5 y recuérdame llevar los exámenes',
    reqId: 'r4',
  })
  assert.equal(out.actions.length, 2, JSON.stringify(out._dropped))
  // Doctor → add_event normal.
  assert.equal(out.actions[0].type, 'add_event')
  assert.equal(out.actions[0].event.title, 'Doctor')
  assert.equal(out.actions[0].event.time, '5:00 PM')
  assert.equal(out.actions[0].event.icon, 'local_hospital')
  // Recordatorio SIN hora → add_task. Antes era add_event con time=null
  // → iOS lo dropeaba silenciosamente (FocusEvent.startTime no es
  // opcional). Ahora se materializa en Tareas, visible al user.
  assert.equal(out.actions[1].type, 'add_task')
  assert.equal(out.actions[1].task.label, 'Llevar los exámenes')
})

// ─── QA case 5: "hoy a las 5 gimnasio y a las 8 estudiar" ──────────────────

test('caso 5: dos eventos con horas → 2 actions correctas', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        event({ title: 'Gimnasio', dateText: 'hoy', dateISO: '2026-05-19', time: '17:00', category: 'personal', sourceText: 'gimnasio' }),
        event({ title: 'Estudiar', dateText: 'hoy', dateISO: '2026-05-19', time: '20:00', category: 'estudio', sourceText: 'estudiar' }),
      ],
    }),
    userMessage: 'hoy a las 5 gimnasio y a las 8 estudiar',
    reqId: 'r5',
  })
  assert.equal(out.actions.length, 2)
  assert.equal(out.actions[0].event.title, 'Gimnasio')
  assert.equal(out.actions[0].event.time, '5:00 PM')
  assert.equal(out.actions[1].event.title, 'Estudiar')
  assert.equal(out.actions[1].event.time, '8:00 PM')
})

// ─── QA case 6: "mañana a las 10 reunión con Juan Pablo y a las 4 dentista" ──

test('caso 6: reunión con JP + dentista → 2 actions, "Reunión" conserva quién', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        event({ title: 'Reunión con Juan Pablo', dateText: 'mañana', dateISO: '2026-05-20', time: '10:00', category: 'reunion', sourceText: 'reunión con Juan Pablo' }),
        event({ title: 'Dentista', dateText: 'mañana', dateISO: '2026-05-20', time: '16:00', category: 'salud', sourceText: 'dentista' }),
      ],
    }),
    userMessage: 'mañana a las 10 reunión con Juan Pablo y a las 4 dentista',
    reqId: 'r6',
  })
  assert.equal(out.actions.length, 2)
  assert.equal(out.actions[0].event.title, 'Reunión con Juan Pablo')
  assert.equal(out.actions[1].event.title, 'Dentista')
})

test('caso 6-defensa: "Reunión" pelado sin persona/asunto se descarta', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Reunión', time: '10:00', sourceText: 'reunión' })],
    }),
    userMessage: 'mañana reunión a las 10',
    reqId: 'r6b',
  })
  assert.equal(out.actions.length, 0)
  assert.ok(out._dropped[0].includes('genérico sin contexto'))
})

// ─── QA case 7: "recuérdame llamar a mi mamá a las 6 y comprar cuaderno mañana"

test('caso 7: reminder con hora + reminder sin hora → 1 add_event puntual + 1 add_task', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        reminder({ title: 'Llamar a mi mamá', dateText: 'hoy', dateISO: '2026-05-19', time: '18:00', sourceText: 'llamar a mi mamá a las 6' }),
        reminder({ title: 'Comprar cuaderno', dateText: 'mañana', dateISO: '2026-05-20', time: null, sourceText: 'comprar cuaderno mañana' }),
      ],
    }),
    userMessage: 'recuérdame llamar a mi mamá a las 6 y comprar cuaderno mañana',
    reqId: 'r7',
  })
  assert.equal(out.actions.length, 2, JSON.stringify(out._dropped))
  // Reminder CON hora → add_event con icon=alarm. iOS detecta isReminder
  // por el icon + el trigger en userText y crea el FocusEvent con
  // isReminder=true en startTime=18:00. CRÍTICO: el time DEBE venir, no
  // null — antes se forzaba a null y el iOS silenciosamente droppeaba la
  // acción porque FocusEvent.startTime no es opcional.
  assert.equal(out.actions[0].type, 'add_event')
  assert.equal(out.actions[0].event.title, 'Llamar a mi mamá')
  assert.equal(out.actions[0].event.icon, 'alarm')
  assert.equal(out.actions[0].event.time, '6:00 PM')
  // Reminder SIN hora → add_task (FocusEvent exige startTime; un reminder
  // sin hora conceptualmente ES una tarea pendiente).
  assert.equal(out.actions[1].type, 'add_task')
  assert.equal(out.actions[1].task.label, 'Comprar cuaderno')
  assert.equal(out.actions[1].task.category, 'semana')
})

test('caso 7b: "acuérdame que a las 2 estudiar arte" → add_event puntual con time + icon alarm', () => {
  // Regresión del bug reportado el 2026-05-23: el usuario decía
  // "acuérdame que a las 2 tengo que estudiar arte e ideas", Nova
  // respondía "Listo, te recordaré..." pero NADA se agregaba al calendario
  // porque el adapter forzaba time:null para create_reminder, y el iOS
  // dropea add_event con time:null.
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        reminder({
          title: 'Estudiar arte e ideas',
          dateText: 'hoy',
          dateISO: '2026-05-19',
          time: '14:00',
          sourceText: 'estudiar arte e ideas',
        }),
      ],
      userConfirmationText: 'Listo, te recordaré estudiar arte e ideas hoy a las 14:00.',
    }),
    userMessage: 'acuérdame que a las 2 tengo que estudiar arte e ideas',
    reqId: 'r7b',
  })
  assert.equal(out.actions.length, 1, JSON.stringify(out._dropped))
  assert.equal(out.actions[0].type, 'add_event')
  assert.equal(out.actions[0].event.title, 'Estudiar arte e ideas')
  assert.equal(out.actions[0].event.time, '2:00 PM')
  assert.equal(out.actions[0].event.icon, 'alarm')
  assert.equal(out.actions[0].event.date, '2026-05-19')
  assert.equal(out.mode, 'chat_with_action')
})

// ─── QA case 8: "hoy tengo que entregar trabajo del Master" (sin hora) ─────

test('caso 8: entrega sin hora → 1 event hoy con time:null, NO inventa hora', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({
        title: 'Entregar trabajo del Master',
        dateText: 'hoy',
        dateISO: '2026-05-19',
        time: null,
        category: 'universidad',
        sourceText: 'entregar trabajo del Master',
      })],
    }),
    userMessage: 'hoy tengo que entregar trabajo del Master',
    reqId: 'r8',
  })
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].event.title, 'Entregar trabajo del Master')
  assert.equal(out.actions[0].event.time, null)
  assert.equal(out.actions[0].event.date, '2026-05-19')
})

// ─── Anti-contaminación: "entregar trabajo" → NO se transforma en "Reunión con Cristina"

test('contaminación: título "Reunión con Cristina" cuando el input no la menciona → descartado', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({
        title: 'Reunión con Cristina',
        dateText: 'hoy',
        dateISO: '2026-05-19',
        time: '14:00',
        sourceText: 'Reunión con Cristina', // bug: el modelo inventó esto
      })],
    }),
    userMessage: 'hoy tengo que entregar trabajo del Master',
    reqId: 'rc1',
  })
  assert.equal(out.actions.length, 0)
  assert.ok(
    out._dropped.some(r => r.includes('contaminación')),
    `dropped: ${JSON.stringify(out._dropped)}`,
  )
})

// ─── Confidence handling ────────────────────────────────────────────────────

test('confidence low: acción descartada y reply pide aclaración', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Reunión con alguien', time: '10:00', confidence: 'low', sourceText: 'reunión con alguien' })],
      needsClarification: true,
      clarificationQuestion: '¿Con quién es la reunión?',
    }),
    userMessage: 'mañana reunión con alguien',
    reqId: 'rc2',
  })
  assert.equal(out.actions.length, 0)
  assert.equal(out.shouldAskUser, true)
  assert.equal(out.mode, 'clarification')
  assert.ok(out.reply.includes('¿Con quién'))
})

// ─── Mixed: clarify type + create_event ─────────────────────────────────────

test('mixed: una acción clara + un clarify → emite la clara, agrega pregunta al reply', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [
        event({ title: 'Doctor', dateText: 'mañana', dateISO: '2026-05-20', time: '17:00', category: 'salud', sourceText: 'doctor a las 5' }),
        { type: 'clarify', title: '¿A qué hora es la otra cosa?', dateText: '', dateISO: null, time: null, durationMinutes: 0, category: 'otro', reminderOffsetMinutes: null, linkedToPreviousEvent: false, confidence: 'low', sourceText: 'otra cosa' },
      ],
      needsClarification: true,
      clarificationQuestion: '¿A qué hora es la otra cosa?',
      userConfirmationText: 'Agregué Doctor.',
    }),
    userMessage: 'mañana tengo doctor a las 5 y otra cosa',
    reqId: 'rm1',
  })
  assert.equal(out.actions.length, 1)
  assert.equal(out.actions[0].event.title, 'Doctor')
  assert.equal(out.shouldAskUser, false) // hubo acción ejecutable
  assert.ok(out.reply.includes('Doctor'))
  assert.ok(out.reply.includes('¿A qué hora'))
})

// ─── Endpoint shape: payload tiene los campos que iOS espera ────────────────

test('endpoint shape: respuesta mapeada tiene los campos que NovaService decodifica', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Gimnasio', time: '17:00', sourceText: 'gimnasio' })],
      userConfirmationText: 'Listo.',
    }),
    userMessage: 'gimnasio a las 5',
    reqId: 'rid-shape',
  })
  for (const key of ['reply', 'actions', 'proposed_actions', 'confidence', 'shouldAskUser', 'mode', 'requestId']) {
    assert.ok(Object.prototype.hasOwnProperty.call(out, key), `falta key: ${key}`)
  }
  assert.equal(out.requestId, 'rid-shape')
  assert.equal(typeof out.confidence, 'number')
  assert.ok(out.confidence >= 0 && out.confidence <= 1)
})

// ─── Defensa duration → endTime ────────────────────────────────────────────

test('duration: usuario dijo "por una hora" + durationMinutes:60 → endTime 6:00 PM', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Gimnasio', time: '17:00', durationMinutes: 60, sourceText: 'gimnasio por una hora' })],
    }),
    userMessage: 'gimnasio a las 5 por una hora',
    reqId: 'rdur',
  })
  assert.equal(out.actions[0].event.time, '5:00 PM')
  assert.equal(out.actions[0].event.endTime, '6:00 PM')
})

test('duration safety net: usuario NO dijo duración + durationMinutes:60 → endTime NULL', () => {
  // Regresión del bug 2026-05-23: el usuario decía "tengo que estudiar
  // arte a las 2", el modelo emitía durationMinutes:60 default, y el
  // adapter calculaba endTime "3:00 PM" → iOS mostraba bloque
  // "14:00-15:00" con "1h". El usuario quería solo "14:00".
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Estudiar arte', time: '14:00', durationMinutes: 60, sourceText: 'estudiar arte' })],
    }),
    userMessage: 'tengo que estudiar arte a las 2',
    reqId: 'rdur-safety',
  })
  assert.equal(out.actions[0].event.time, '2:00 PM')
  assert.equal(out.actions[0].event.endTime, null,
    'sin keyword de duración en el input, endTime debe quedar null aunque el modelo emita durationMinutes:60')
})

test('duration: "de 2 a 4" → rango explícito, respeta durationMinutes:120', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Estudiar', time: '14:00', durationMinutes: 120, sourceText: 'estudiar de 2 a 4' })],
    }),
    userMessage: 'estudiar de 2 a 4',
    reqId: 'rdur-rango',
  })
  assert.equal(out.actions[0].event.time, '2:00 PM')
  assert.equal(out.actions[0].event.endTime, '4:00 PM')
})

test('duration: "media hora" → respeta durationMinutes:30', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [event({ title: 'Caminar', time: '18:00', durationMinutes: 30, sourceText: 'caminar media hora' })],
    }),
    userMessage: 'caminar media hora a las 6',
    reqId: 'rdur-media',
  })
  assert.equal(out.actions[0].event.endTime, '6:30 PM')
})

test('duration: reminder sin hora → convertido a add_task (no add_event)', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [reminder({ title: 'Llamar a Marcia', time: null })],
    }),
    userMessage: 'recuérdame llamar a Marcia',
    reqId: 'rdur2',
  })
  assert.equal(out.actions[0].type, 'add_task')
  assert.equal(out.actions[0].task.label, 'Llamar a Marcia')
})

test('duration: reminder CON hora → add_event con icon alarm + endTime null (punto en el tiempo)', () => {
  const out = convertOpenAIToBackendResponse({
    openaiPayload: fakeOpenAIPayload({
      actions: [reminder({ title: 'Llamar a Marcia', time: '18:30' })],
    }),
    userMessage: 'recuérdame llamar a Marcia a las 18:30',
    reqId: 'rdur3',
  })
  assert.equal(out.actions[0].type, 'add_event')
  assert.equal(out.actions[0].event.time, '6:30 PM')
  assert.equal(out.actions[0].event.icon, 'alarm')
  // No durationMinutes en el payload → endTime null. iOS aplica padding
  // interno de 5min pero la UI lo muestra como punto en el tiempo.
  assert.equal(out.actions[0].event.endTime, null)
})

// ─── Reglas nuevas Bug1+Bug2: verificación system prompt ────────────────────

test('system prompt contiene regla "ocho 30" con ejemplo concreto de título limpio', () => {
  const p = buildOpenAISystemPrompt({
    tz: 'America/Santiago', todayISO: '2026-05-19', tomorrow: '2026-05-20',
    currentTime24: '09:00', weekDates: {},
  })
  // Regla 3 debe mencionar el patrón explícito "ocho 30" → 08:30
  assert.ok(p.includes('ocho 30'), 'debe mencionar "ocho 30" como patrón')
  // Regla 4 debe incluir strip de temporal + ejemplo con "30 del Master"
  assert.ok(p.includes('30 del Master') || p.includes('ocho 30 del Master'), 'debe mostrar ejemplo con "30 del Master" en el contexto del título')
  // Regla 3 debe mencionar secuencia PM
  assert.ok(p.includes('SECUENCIA AM/PM') || p.includes('secuencia'), 'debe tener regla de secuencia PM')
})

test('system prompt contiene ejemplo de secuencia: 5 gimnasio y 8 estudiar → 17:00 y 20:00', () => {
  const p = buildOpenAISystemPrompt({
    tz: 'America/Santiago', todayISO: '2026-05-19', tomorrow: '2026-05-20',
    currentTime24: '09:00', weekDates: {},
  })
  // Debe tener el ejemplo concreto de gimnasio/estudiar con horas PM
  assert.ok(p.includes('gimnasio') && p.includes('20:00'), 'debe tener ejemplo gimnasio+estudiar con 20:00')
})
