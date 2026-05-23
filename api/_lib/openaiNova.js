// Cliente OpenAI para Nova — alternativa al provider Anthropic.
//
// Activado por `NOVA_PROVIDER=openai`. Requiere `OPENAI_API_KEY` en
// el environment. Modelo configurable por `OPENAI_NOVA_MODEL` (default
// "gpt-5.5"). Si el modelo no existe en runtime, OpenAI devuelve 404
// y el handler cae a Anthropic — definido en focus-assistant.js.
//
// El archivo encapsula tres cosas:
//   1. Schema JSON estricto (Structured Outputs).
//   2. Prompt fuerte español chileno + zona horaria del cliente.
//   3. Adapter del contrato OpenAI al `BackendAction` que ya consume iOS.
//
// Diseño: iOS NUNCA ve el contrato OpenAI. Recibe el mismo
// `{reply, actions:[{type:"add_event", event:{...}}]}` que recibe de
// Anthropic. La normalización vive entera acá.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-5.5'
const DEFAULT_TIMEOUT_MS = 45_000

// ─── Schema (Structured Outputs) ────────────────────────────────────────────
// Forma exacta del JSON que OpenAI debe devolver. `strict: true` en la
// llamada bloquea cualquier desvío. Los enums están en el schema (no en
// el prompt) para que la API rechace valores fuera de la lista.

export const NOVA_OPENAI_SCHEMA = {
  name: 'nova_actions',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['actions', 'needsClarification', 'clarificationQuestion', 'userConfirmationText'],
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'type', 'title', 'dateText', 'dateISO', 'time',
            'durationMinutes', 'category', 'reminderOffsetMinutes',
            'linkedToPreviousEvent', 'confidence', 'sourceText',
          ],
          properties: {
            type: { type: 'string', enum: ['create_event', 'create_reminder', 'clarify'] },
            title: { type: 'string' },
            // Texto humano de fecha como lo dijo el usuario ("hoy",
            // "mañana", "el viernes", "el 15"). Útil para confirmaciones.
            dateText: { type: 'string' },
            // Fecha resuelta YYYY-MM-DD en zona del usuario. null si la
            // acción no tiene fecha (clarify) o falta info.
            dateISO: { type: ['string', 'null'] },
            // Hora HH:mm 24h. null si no hay hora (recordatorio sin hora,
            // evento de día completo, clarify).
            time: { type: ['string', 'null'] },
            // Duración default 60. Para recordatorios usar 0.
            durationMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
            category: {
              type: 'string',
              enum: ['personal', 'universidad', 'salud', 'reunion', 'estudio', 'otro'],
            },
            // Si el usuario pidió "avísame N min antes", el offset va acá.
            reminderOffsetMinutes: { type: ['integer', 'null'] },
            // True si esta acción depende temporal o temáticamente de la
            // anterior (ej: el recordatorio hereda fecha del evento).
            linkedToPreviousEvent: { type: 'boolean' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            // Fragmento literal del input que originó esta acción. Es la
            // defensa contra alucinación: si esto no aparece en el input,
            // descartamos la acción.
            sourceText: { type: 'string' },
          },
        },
      },
      needsClarification: { type: 'boolean' },
      clarificationQuestion: { type: ['string', 'null'] },
      // Texto humano breve para mostrar al usuario después de crear.
      userConfirmationText: { type: 'string' },
    },
  },
}

// ─── Prompt sistema ─────────────────────────────────────────────────────────

/**
 * Construye el system prompt fuerte. Mantiene las reglas críticas del
 * prompt Anthropic pero condensa: Structured Outputs ya garantiza el
 * formato — acá solo definimos comportamiento.
 */
export function buildOpenAISystemPrompt({ tz, todayISO, tomorrow, currentTime24, weekDates }) {
  return `Eres Nova, la asistente del usuario dentro de la app Focus. Hablas español neutro (forma "tú", sin voseo). Tu trabajo es convertir lo que escribe el usuario en una lista de acciones estructuradas para su calendario.

Contexto temporal (CRÍTICO — úsalo SIEMPRE):
- timezone: ${tz}
- hoy ISO: ${todayISO}
- mañana ISO: ${tomorrow}
- hora actual 24h: ${currentTime24}
- mapa de semana: ${JSON.stringify(weekDates)}

REGLAS DURAS (no negociables):

1. "hoy" = ${todayISO}. "mañana" = ${tomorrow}. Si el usuario dice un día de la semana (lunes, martes, ...), úsalo del mapa de semana.

2. Una acción POR cosa. Si el usuario encadena con "y", "también", "luego", "después", "y recuérdame", "y acuérdame", "y avísame", separa en varias actions. Si dice "evento + recordatorio en la misma frase" → 2 actions, NUNCA una sola.

3. Interpretación de horas:
   - "a las 5" en contexto de gimnasio/doctor/reunión/clase de adultos: 17:00 (PM).
   - "a las 5" en contexto de despertar/desayuno: 05:00 (AM).
   - "a las 8" en contexto matutino/escolar/despertar: 08:00.
   - "a las 8" en contexto de cenar/estudiar de noche/gym/post-5pm-secuencia: 20:00.
   - Si la hora actual es ≥19:00 y dice "a las 11" sin "mañana": 23:00 hoy.

   HORA EN PALABRAS + MINUTOS (CRÍTICO — lee esto con atención):
   - Patrón "a las [HORA_TEXTO] [NÚMERO≤59]": el número después de la hora EN PALABRAS siempre son MINUTOS.
   - "a las ocho 30 del Master" → time:"08:30", título:"Entregar trabajo del Master" (el 30 desaparece del título)
   - "a las ocho 30" → time:"08:30"
   - "a las ocho treinta" → time:"08:30"
   - "a las ocho y media" → time:"08:30"
   - "a las cinco 30" → time:"05:30" AM o "17:30" PM según contexto
   - "a las cinco y media" → time:"17:30" si contexto tarde
   - "a las siete quince" / "a las siete cuarto" → time:"07:15" o "19:15" según contexto
   - REGLA ABSOLUTA: un número ≤59 que sigue inmediatamente a una hora en palabras son MINUTOS.
     NUNCA incluir ese número en el título. "30 del Master" ≠ parte del título cuando el 30 es minuto de hora.

   SECUENCIA AM/PM EN MÚLTIPLES EVENTOS (CRÍTICO):
   - Si hay 2+ eventos en el MISMO mensaje y el primero fue asignado PM, el segundo NO puede quedar antes cronológicamente sin razón explícita del usuario.
   - "hoy a las 5 gimnasio y a las 8 estudiar" → Gimnasio 17:00, Estudiar 20:00. (NO 08:00 — el 8 es PM porque sigue al gym de 17h)
   - "mañana a las 10 reunión y a las 4 dentista" → Reunión 10:00, Dentista 16:00.
   - "hoy a las 2 almuerzo y a las 5 gym" → Almuerzo 14:00, Gym 17:00.
   - REGLA: Si hora_B < hora_A en formato 24h, y hora_B puede ser PM sin contradecir el sentido → hora_B = hora_B + 12h.

   - Si REALMENTE no hay contexto para decidir AM/PM → confidence "medium" + clarificationQuestion ofreciendo opciones.

4. TÍTULOS:
   - Extrae UN sustantivo + complementos concretos. NO repitas la frase entera del usuario.
   - "mañana entregar trabajo a las ocho 30 del Master" → title:"Entregar trabajo del Master". NUNCA "Mañana entregar trabajo 30 del Master".
   - "hoy a las 4 desayuno con Marcia" → title:"Desayuno con Marcia". NUNCA "Horas", NUNCA "Hoy".
   - "tengo doctor a las 5" → title:"Doctor". NO "Tengo doctor".
   - "reunión con Juan Pablo" → title:"Reunión con Juan Pablo" (mantén el con-quién).
   - STRIP OBLIGATORIO antes de generar el título:
     (a) Eliminar palabras temporales al inicio: "hoy", "mañana", "el lunes", "el martes", etc.
     (b) Eliminar expresiones de hora completas: "a las ocho 30", "a las 5", "a las 17:00", "a las ocho y media".
     (c) Eliminar números que son minutos de una hora en palabras: si el input tiene "ocho 30", el "30" no va al título.
   - PROHIBIDO emitir título genérico vacío: "Horas", "Hoy", "Mañana", "Evento", "Recordatorio", "A las 5", "Reunión" sin persona/asunto, "Clase" sin materia, "Trabajo" sin sujeto.
   - Si el input es ambiguo y no puedes extraer un título real, emite type:"clarify" en vez de inventar.

5. ANTI-CONTAMINACIÓN (CRÍTICO):
   - El campo sourceText debe contener UN fragmento LITERAL del input del usuario que originó esta acción. Sin paráfrasis.
   - NUNCA uses como título un evento previo del usuario que no esté literalmente en el input actual.
   - "entregar trabajo" del input NUNCA puede convertirse en "Reunión con Cristina" o cualquier título de evento previo.
   - Si dudas si el título proviene del input o de un evento previo, descarta y emite clarify.

6. RECORDATORIOS:
   - type:"create_reminder" SOLO cuando el usuario dice trigger explícito ("recuérdame", "acuérdame", "avísame", "que no se me olvide", "no te olvides") O cuando es claramente una nota sin compromiso de calendario.
   - Si dijo "avísame N minutos antes de X", emite UN solo create_event para X con reminderOffsetMinutes:N. NO emitas un create_reminder separado.
   - Si dijo "recuérdame X" sin evento padre y sin hora, emite create_reminder con time:null y dateISO heredado del contexto (si la frase tiene "mañana"/"hoy" cerca, úsalo).
   - Si dijo "acuérdame que a las HH X" o "recuérdame X a las HH" (trigger reminder + hora propia, sin evento padre): emite create_reminder CON time = "HH:MM" y dateISO. Esto crea un recordatorio puntual a esa hora. NO emitas time:null en este caso — el time es la hora del recordatorio.
   - Si en la MISMA frase hay un evento ("tengo doctor a las 5") + recordatorio independiente ("y recuérdame llevar exámenes"): 2 actions. El recordatorio HEREDA dateISO del evento si no tiene fecha propia.

7. CATEGORÍAS:
   - "doctor", "dentista", "psiquiatra", "control", "consulta": salud
   - "clase", "prueba", "examen", "tarea de", "trabajo del [Master|Magister|Curso]": universidad/estudio
   - "reunión", "junta", "1:1", "call", "meet": reunion
   - "gym", "gimnasio", "entrenar", "correr", "yoga": personal
   - "desayuno", "almuerzo", "comida", "cena" con persona: reunion. Solo: personal.
   - "estudiar": estudio
   - Resto: otro o personal según contexto.

8. CONFIDENCE:
   - "high": título limpio + fecha clara + hora clara (si aplica).
   - "medium": algo es claro pero hay 1 ambigüedad menor (ej. AM/PM 12:00).
   - "low": NO emitas la acción; cambia el type a "clarify" o sube needsClarification:true.

9. CLARIFICATION:
   - needsClarification:true SOLO si hay AL MENOS una parte que requiere preguntar al usuario.
   - Si parte del input es claro y parte ambiguo: crea la parte clara como create_event/reminder Y emite UN clarify para la parte ambigua.
   - clarificationQuestion: una sola pregunta concreta con opciones (ej. "¿A qué hora es la reunión, AM o PM?").

10. userConfirmationText:
    - Frase breve para mostrar al usuario después de crear. Si hay 1 acción: "Listo, agendé X mañana a las Y". Si hay 2+: "Listo, agendé: X mañana 10:00, Y mañana 16:00". Si needsClarification: la pregunta en sí.
    - Máximo 1-2 oraciones. Sin emojis, sin markdown.

DEVUELVE EXCLUSIVAMENTE el JSON del schema. Sin texto fuera del objeto.`
}

// ─── Cliente HTTP ────────────────────────────────────────────────────────────

/**
 * Llama Responses API de OpenAI con Structured Outputs.
 * Lanza error con código HTTP si la respuesta no es 2xx.
 */
export async function callOpenAINova({
  message,
  systemPrompt,
  model,
  apiKey,
  reqId,
  signal,
}) {
  const body = {
    model: model || process.env.OPENAI_NOVA_MODEL || DEFAULT_MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    text: {
      format: {
        type: 'json_schema',
        ...NOVA_OPENAI_SCHEMA,
      },
    },
  }

  const controller = signal ? null : new AbortController()
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Request-Id': reqId || '',
      },
      body: JSON.stringify(body),
      signal: signal || controller?.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      const err = new Error(`OpenAI HTTP ${response.status}: ${errText.slice(0, 200)}`)
      err.status = response.status
      throw err
    }

    const data = await response.json()
    return data
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * Extrae el texto JSON del payload de Responses API. Soporta ambos shapes
 * que OpenAI ha usado: `output_text` (atajo) y `output[].content[].text`.
 * Si no encuentra texto, lanza.
 */
export function extractResponsesText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.length > 0) {
    return data.output_text
  }
  const output = Array.isArray(data?.output) ? data.output : []
  for (const item of output) {
    if (!item) continue
    const content = Array.isArray(item.content) ? item.content : []
    for (const c of content) {
      if (typeof c?.text === 'string' && c.text.length > 0) return c.text
      if (typeof c?.text?.value === 'string' && c.text.value.length > 0) return c.text.value
    }
  }
  throw new Error('OpenAI Responses: no output text found')
}

// ─── Adapter contrato OpenAI → BackendAction (cliente iOS) ──────────────────

/**
 * Lista negra de títulos basura. Mismo principio que NovaActionValidator
 * en iOS: si tras strip queda un genérico vacío, no crear nada.
 */
const BARE_GARBAGE_TITLES = new Set([
  'hora', 'horas', 'hoy', 'mañana', 'manana',
  'evento', 'recordatorio', 'tarea', 'tarea sin título',
  'a las', 'a las 5', 'ev', 'rec', '...', '',
  // Genéricos sin persona/materia/asunto — sospechosos pero podrían ser
  // legítimos en algunos casos. Mantenemos un grupo separado abajo.
])
const GENERIC_NEEDS_CONTEXT = new Set([
  'reunión', 'reunion', 'clase', 'trabajo', 'tarea',
])

/**
 * Normaliza un string para comparación (sin tildes, lowercase, sin punct
 * final). Útil para la verificación sourceText ∈ input.
 */
function normForCompare(s) {
  if (typeof s !== 'string') return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:]+\s*$/, '')
    .trim()
}

/**
 * Hora 24h "HH:mm" → string "H:MM AM/PM" que el cliente iOS espera.
 * Soporta "8:30" y "08:30". Devuelve null si el input es null/inválido.
 */
function timeStringTo12h(hhmm) {
  if (typeof hhmm !== 'string' || hhmm.length === 0) return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  const ampm = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`
}

/**
 * "YYYY-MM-DD" en zona del servidor para comparar con dateISO emitido por
 * el modelo. La elección de hoy vs semana para reminders sin hora es una
 * heurística suave — no es crítico que esté en la TZ exacta del usuario
 * porque el iOS también puede mover la categoría después.
 */
function todayISOFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const CATEGORY_TO_ICON = {
  salud: 'local_hospital',
  reunion: 'groups',
  estudio: 'menu_book',
  universidad: 'menu_book',
  personal: 'event',
  otro: 'event',
}

const CATEGORY_TO_SECTION = {
  salud: 'evening',
  reunion: 'focus',
  estudio: 'focus',
  universidad: 'focus',
  personal: 'evening',
  otro: 'evening',
}

const CONFIDENCE_NUMERIC = {
  high: 0.9,
  medium: 0.65,
  low: 0.35,
}

/**
 * Convierte la respuesta de OpenAI al shape que `focus-assistant.js`
 * devuelve al cliente iOS:
 *
 *   { reply, actions, proposed_actions, confidence, shouldAskUser, mode, requestId }
 *
 * Aplica defensas:
 *  - sourceText debe estar en el input → si no, descartar acción.
 *  - title no debe ser bare garbage → si lo es, descartar acción.
 *  - confidence "low" sin clarify → descartar y forzar clarification.
 *  - clarify type → no genera action, contribuye a reply.
 */
export function convertOpenAIToBackendResponse({
  openaiPayload,
  userMessage,
  reqId,
}) {
  const inputNorm = normForCompare(userMessage)
  const raw = openaiPayload
  const incomingActions = Array.isArray(raw?.actions) ? raw.actions : []
  const safeActions = []
  const droppedReasons = []
  const clarifications = []

  for (const a of incomingActions) {
    if (!a || typeof a !== 'object') continue

    // 1) Type clarify → no action, sumar pregunta.
    if (a.type === 'clarify') {
      const q = (typeof a.title === 'string' && a.title) || raw?.clarificationQuestion || null
      if (q) clarifications.push(q)
      continue
    }

    const titleRaw = typeof a.title === 'string' ? a.title.trim() : ''
    if (titleRaw.length === 0) {
      droppedReasons.push('title vacío')
      continue
    }

    // 2) Anti-basura: title genérico sin contexto.
    const titleLower = titleRaw.toLowerCase()
    if (BARE_GARBAGE_TITLES.has(titleLower)) {
      droppedReasons.push(`title basura: "${titleRaw}"`)
      continue
    }
    // Genérico-débil: si está en GENERIC_NEEDS_CONTEXT y tiene ≤ 1 palabra,
    // descartar. "Reunión" pelado sin persona es sospechoso.
    if (GENERIC_NEEDS_CONTEXT.has(titleLower) && titleRaw.split(/\s+/).length <= 1) {
      droppedReasons.push(`title genérico sin contexto: "${titleRaw}"`)
      continue
    }
    // Title que sea solo dígitos / solo hora.
    if (/^\d{1,2}(:\d{2})?$/.test(titleRaw)) {
      droppedReasons.push(`title es solo hora: "${titleRaw}"`)
      continue
    }

    // 3) sourceText debe aparecer en el input. Comparación tolerante:
    //    normalizamos ambos y exigimos que algún fragmento de ≥4 chars
    //    del sourceText aparezca en el input. Esto bloquea el caso
    //    "Reunión con Cristina" inyectado por contexto previo cuando el
    //    user no la mencionó.
    const src = typeof a.sourceText === 'string' ? a.sourceText : ''
    if (src.trim().length > 0) {
      const srcNorm = normForCompare(src)
      const found = srcNorm.length >= 4 && inputNorm.includes(srcNorm.slice(0, Math.max(4, Math.min(20, srcNorm.length))))
      // Doble red: también checkear que el título (o palabra clave del
      // título) aparezca en el input. Si NI sourceText NI título aparecen,
      // es contaminación.
      const titleKey = normForCompare(titleRaw.split(/\s+/)[0] || '')
      const titleAppears = titleKey.length >= 3 && inputNorm.includes(titleKey)
      if (!found && !titleAppears) {
        droppedReasons.push(`contaminación: sourceText "${src}" ni título "${titleRaw}" en input`)
        continue
      }
    }

    // 4) Confidence low + no clarify → forzar clarification.
    if (a.confidence === 'low') {
      droppedReasons.push(`confidence low: "${titleRaw}"`)
      clarifications.push(
        raw?.clarificationQuestion || `No me quedó claro lo de "${titleRaw}". ¿Me das más detalle?`,
      )
      continue
    }

    // 5) Mapear al BackendAction.
    const isReminder = a.type === 'create_reminder'
    const time12 = timeStringTo12h(a.time)
    const date = typeof a.dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dateISO) ? a.dateISO : null
    const cat = (typeof a.category === 'string' && CATEGORY_TO_ICON[a.category]) ? a.category : 'otro'

    // create_reminder SIN hora → no podemos crear un FocusEvent (iOS exige
    // startTime). Lo emitimos como add_task: una nota pendiente sin hora
    // específica. El icon "alarm" + el trigger ("recuérdame") en el input
    // ya marcan la intención; el iOS lo mostrará en Tareas. Antes esto
    // caía silenciosamente porque iOS dropea add_event con time=null.
    if (isReminder && !time12) {
      const category = date && date === todayISOFromDate(new Date()) ? 'hoy' : 'semana'
      safeActions.push({
        type: 'add_task',
        task: {
          label: titleRaw,
          priority: 'media',
          category,
        },
        _meta: {
          provider: 'openai',
          sourceText: src,
          confidence: a.confidence,
          reqId,
          convertedFromReminderNoTime: true,
        },
      })
      continue
    }

    // endTime se calcula client-side normalmente. Acá solo si tiene hora
    // Y duración > 0; el cliente puede usarlo. Para reminders, null.
    let endTime = null
    if (!isReminder && time12 && typeof a.durationMinutes === 'number' && a.durationMinutes > 0) {
      const [hStr, rest] = time12.split(':')
      const minStr = rest.slice(0, 2)
      const ampm = rest.slice(3)
      let h24 = parseInt(hStr, 10) % 12 + (ampm === 'PM' ? 12 : 0)
      const totalMin = h24 * 60 + parseInt(minStr, 10) + a.durationMinutes
      const eH24 = Math.floor((totalMin / 60) % 24)
      const eM = totalMin % 60
      const eAmPm = eH24 >= 12 ? 'PM' : 'AM'
      let eH12 = eH24 % 12
      if (eH12 === 0) eH12 = 12
      endTime = `${eH12}:${eM.toString().padStart(2, '0')} ${eAmPm}`
    }

    // create_reminder CON hora → add_event con icon "alarm". iOS detecta
    // isReminderHint vía userText ("acuérdame"/"recuérdame") + icon=alarm
    // y crea el FocusEvent con isReminder=true en startTime. Antes el
    // adapter forzaba time=null pensando que era "intencional" — pero
    // sin time el iOS dropea la acción (FocusEvent.startTime no es opcional).
    const event = {
      title: titleRaw,
      time: time12,
      endTime,
      date,
      section: isReminder ? 'evening' : (CATEGORY_TO_SECTION[cat] || 'evening'),
      icon: isReminder ? 'alarm' : (CATEGORY_TO_ICON[cat] || 'event'),
    }
    if (typeof a.reminderOffsetMinutes === 'number' && a.reminderOffsetMinutes >= 0) {
      event.reminderOffsets = [a.reminderOffsetMinutes]
    }

    safeActions.push({
      type: 'add_event',
      event,
      // Metadata extra que iOS puede loguear (no afecta lógica actual).
      _meta: {
        provider: 'openai',
        sourceText: src,
        confidence: a.confidence,
        reqId,
      },
    })
  }

  // Confidence global: promedio simple de las acciones que pasaron.
  let confNum = 1.0
  if (safeActions.length > 0) {
    const total = incomingActions
      .filter(a => a && a.type !== 'clarify')
      .reduce((acc, a) => acc + (CONFIDENCE_NUMERIC[a.confidence] || 0.5), 0)
    confNum = total / Math.max(1, incomingActions.filter(a => a?.type !== 'clarify').length)
  }

  const needsClarification = Boolean(raw?.needsClarification) || clarifications.length > 0
  const baseReply = typeof raw?.userConfirmationText === 'string' ? raw.userConfirmationText : ''
  let reply = baseReply
  if (needsClarification && clarifications.length > 0) {
    const q = (raw?.clarificationQuestion && raw.clarificationQuestion) || clarifications[0]
    reply = reply ? `${reply}\n\n${q}` : q
  }
  if (droppedReasons.length > 0 && safeActions.length === 0 && !needsClarification) {
    reply = reply || 'No pude armar la acción con seguridad. ¿Me das un poco más de detalle?'
  }

  const mode = (() => {
    if (safeActions.length === 0 && needsClarification) return 'clarification'
    if (safeActions.length === 0) return 'chat_only'
    return 'chat_with_action'
  })()

  return {
    reply: reply || 'Listo.',
    actions: safeActions,
    proposed_actions: [],
    smart_actions_blocked: false,
    smart_actions_message: null,
    confidence: confNum,
    shouldAskUser: needsClarification && safeActions.length === 0,
    mode,
    requestId: reqId || null,
    _dropped: droppedReasons,
  }
}
