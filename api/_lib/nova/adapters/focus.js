// FocusNovaAdapter — schema OpenAI + prompt + conversores.
//
// Responsabilidades:
//   1. Definir el `NOVA_OPENAI_SCHEMA` que OpenAI debe respetar (Structured
//      Outputs). El schema sigue siendo el "rich" (con linkedReminders
//      dentro de cada create_event) — es lo que mejor funciona con
//      Structured Outputs y es lo que los 30 tests existentes esperan.
//   2. Construir el system prompt en español neutro para Focus.
//   3. Expandir la respuesta raw a `Action[]` SEMÁNTICAS (con
//      create_linked_reminder + parentActionId): es el contrato Nova Core.
//   4. Colapsar las actions semánticas al shape iOS (`reminderOffsets[]`
//      + `reminderNotes[]` dentro del evento padre) que `NovaService` ya
//      consume desde meses atrás — cero cambios en iOS.
//
// El validator (validator.js) opera sobre las actions SEMÁNTICAS porque
// es ahí donde la intención está limpia. El colapso a iOS es el último
// paso, justo antes de mandar la respuesta al cliente.

// ─── Schema (Structured Outputs) ────────────────────────────────────────────

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
            'linkedReminders', 'supersedesPrevious', 'finalIntentText',
          ],
          properties: {
            type: { type: 'string', enum: ['create_event', 'create_reminder', 'clarify'] },
            title: { type: 'string' },
            dateText: { type: 'string' },
            dateISO: { type: ['string', 'null'] },
            time: { type: ['string', 'null'] },
            durationMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
            category: {
              type: 'string',
              enum: ['personal', 'universidad', 'salud', 'reunion', 'estudio', 'otro'],
            },
            reminderOffsetMinutes: { type: ['integer', 'null'] },
            linkedToPreviousEvent: { type: 'boolean' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            sourceText: { type: 'string' },
            linkedReminders: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'text', 'offsetMinutes'],
                properties: {
                  kind: { type: 'string', enum: ['offset_action', 'checklist_note'] },
                  text: { type: 'string' },
                  offsetMinutes: { type: ['integer', 'null'], minimum: 0, maximum: 1440 },
                },
              },
            },
            // CORRECCIONES HUMANAS — marca SI esta acción reemplaza
            // una versión anterior corregida por el usuario en el mismo
            // mensaje. Es solo TELEMETRÍA: el adapter NO se basa en
            // este flag para colapsar (el LLM debe emitir solo la final).
            // Sirve para confirmar a posteriori que la corrección fue
            // detectada.
            supersedesPrevious: { type: 'boolean' },
            // Fragmento literal del input que representa la intención
            // FINAL (post-corrección). Cuando no hay corrección, igual
            // al sourceText. Cuando hay corrección, es el fragmento
            // posterior al trigger ("a las 5" del "no no mejor a las 5").
            finalIntentText: { type: ['string', 'null'] },
          },
        },
      },
      needsClarification: { type: 'boolean' },
      clarificationQuestion: { type: ['string', 'null'] },
      userConfirmationText: { type: 'string' },
    },
  },
}

// ─── Prompt sistema ─────────────────────────────────────────────────────────

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

   REGLA AM/PM POR HORA PASADA (CRÍTICA — bug real beta-15):
   - Si la hora que el usuario menciona (sin AM/PM explícito ni "mañana") es MENOR que la hora actual del día Y se entiende como evento/recordatorio futuro: asume PM (suma 12 horas).
   - "recuérdame llamar a mi mamá a las 6" con hora actual 11:30 → 18:00, NUNCA 06:00 (ya pasó).
   - "recuérdame llamar a mi mamá a las 7" con hora actual 11:30 → 19:00, NUNCA 09:00 (ya pasó).
   - "tengo gimnasio a las 4" con hora actual 14:00 → 16:00, NUNCA 04:00.
   - REGLA: el evento/reminder se crea para el FUTURO. Si la hora propuesta ya pasó hoy, súmale 12 (PM) en lugar de dejarlo en el pasado.

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

6. RECORDATORIOS — VINCULADOS vs INDEPENDIENTES (CRÍTICO):

   VINCULADOS A UN EVENTO ("acuérdame X" donde X depende del evento mencionado):
   - Si en la misma frase hay un evento + un recordatorio temáticamente dependiente del evento (cosas que llevar al evento, salir antes del evento, preparar para el evento), NO emitas un create_reminder separado. Emite UN create_event con esos recordatorios dentro de \`linkedReminders[]\`.
   - Triggers de dependencia: "salir N antes", "avisarme N antes", "llevar X", "echar X", "preparar X", "cargar X", "revisar X antes", "comprar X antes", "mandar X antes", "que no se me quede X", "que no se me olvide X", "no se me pueden quedar X".
   - Mapeo a \`kind\`:
     • "salir N min antes", "avisarme N antes" → kind:"offset_action", offsetMinutes:N, text:"Salir N min antes"
     • "llevar X", "echar X", "cargar X", "preparar X", "comprar X", "revisar X" → kind:"checklist_note", offsetMinutes:null, text:"Llevar X" (infinitivo, sin imperativo)
   - Ejemplos:
     "fútbol hoy a las 4, acuérdame salir 20 min antes y llevar zapatos de fútbol"
     → 1 create_event Fútbol con linkedReminders:[
         {kind:"offset_action", offsetMinutes:20, text:"Salir 20 min antes"},
         {kind:"checklist_note", offsetMinutes:null, text:"Llevar zapatos de fútbol"}
       ]
     "mañana doctor a las 5 y recuérdame llevar los exámenes"
     → 1 create_event Doctor con linkedReminders:[
         {kind:"checklist_note", offsetMinutes:null, text:"Llevar los exámenes"}
       ]
     "reunión con Juan Pablo a las 12 y recuérdame salir 30 min antes"
     → 1 create_event Reunión con Juan Pablo con linkedReminders:[
         {kind:"offset_action", offsetMinutes:30, text:"Salir 30 min antes"}
       ]
     "clases mañana a las 9 y recuérdame cargar el computador y llevar la botella"
     → 1 create_event Clases con linkedReminders:[
         {kind:"checklist_note", offsetMinutes:null, text:"Cargar el computador"},
         {kind:"checklist_note", offsetMinutes:null, text:"Llevar la botella"}
       ]

   MULTI-EVENTO CON SUB-RECORDATORIO (matching semántico):
   - Si hay 2+ eventos en el mismo mensaje y un sub-recordatorio sin offset explícito, asocialo al evento semánticamente más cercano:
     • zapatos / botella / pelota / uniforme / casco → deporte (fútbol, gym, tenis, partido)
     • computador / laptop / cuaderno / libros / cargador → estudio, clases, trabajo
     • exámenes / recetas / medicamentos / boletas médicas → salud (doctor, dentista, control)
     • regalo / tarjeta → cumpleaños, fiesta, aniversario
   - Ejemplo: "hoy a las 5 fútbol, a las 8 estudiar y acuérdame llevar zapatos"
     → 2 create_event: Fútbol 17:00 con linkedReminders:[{kind:"checklist_note", text:"Llevar zapatos"}], Estudiar 20:00 sin linkedReminders.

   INDEPENDIENTES (NO van dentro de un evento):
   - "recuérdame llamar a mi mamá a las 6" → create_reminder con time:"18:00", sin linkedReminders.
   - "recuérdame comprar pan mañana" → create_reminder con dateISO de mañana, time:null.
   - "recuérdame pagar la matrícula" → create_reminder con time:null y dateISO heredado.
   - Si "recuérdame X" NO tiene evento padre claro o X no depende del evento, emite create_reminder separado.

   NO mezcles linkedReminders en create_reminder — el campo solo aplica a create_event. En create_reminder emite linkedReminders:[].

   reminderOffsetMinutes (legacy) — emítelo null cuando uses linkedReminders[]. Solo úsalo si NO hay sub-recordatorios y el usuario pidió un único aviso ("avísame 10 min antes" sin cosas que llevar).

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

11. CORRECCIONES HUMANAS — INTENCIÓN FINAL (CRÍTICO):

    El usuario puede corregirse a mitad de frase, sobre todo cuando habla por audio. NUNCA crees acciones con la versión DESCARTADA. Emite SOLO la versión final.

    BUGS PROHIBIDOS — NUNCA, JAMÁS hagas esto:
    ❌ Input "fútbol a las 4, no no mejor a las 5" → title:"Fútbol , no no mejor", time:"16:00" — TODO MAL.
    ✅ MISMO INPUT → title:"Fútbol", time:"17:00", supersedesPrevious:true, finalIntentText:"a las 5".

    El título DEBE ser limpio (solo el sustantivo del evento). La hora DEBE ser la POST-corrección (5 PM = 17:00). NUNCA metas los triggers de corrección ("no", "no no", "mejor", "espera", "perdón") DENTRO del título — esos triggers son AVISO de que viene la versión correcta, NO parte del nombre del evento.

    REGLA DURA: si tu título incluye "no no", "no mejor", "mejor a las", "espera", "perdón" → ESTÁ MAL. Vuelve a leer el input, descarta TODO antes del trigger, conserva SOLO la versión post-trigger.

    Triggers de corrección (cuando aparecen, descartar lo anterior y usar lo que viene después):
    - "no no", "no, no"
    - "no, mejor", "mejor", "mejor hazlo", "mejor a las", "mejor el"
    - "espera", "espera mejor", "espera a las"
    - "perdón", "perdona", "perdón, era", "perdón, fue"
    - "me equivoqué", "me equivoque"
    - "al final", "en realidad", "la verdad"
    - "cámbialo a", "cambialo a", "cambia eso por", "cambia a"
    - "no, era", "no era", "no era eso"
    - "déjalo", "dejalo en", "déjalo en"
    - "olvida eso", "olvídate de eso", "eso no"

    Para cada acción que sufrió corrección:
    - emite UNA SOLA acción con los valores finales (post-trigger)
    - marca \`supersedesPrevious: true\`
    - \`finalIntentText\`: fragmento literal del input que define la intención final (ej: "a las 5", "mañana", "llevar la receta")
    - \`sourceText\`: igual al de siempre, fragmento literal del input que originó la acción (puede incluir antes y después de la corrección)

    Para acciones sin corrección:
    - \`supersedesPrevious: false\`
    - \`finalIntentText\`: igual al sourceText (o el sourceText mismo)

    REGLAS DE QUÉ SE CORRIGE:
    - "mañana fútbol a las 4, no no mejor a las 5" → corrige HORA. 1 evento "Fútbol" mañana 17:00. supersedesPrevious:true, finalIntentText:"a las 5".
    - "recuérdame llamar a mi mamá a las 6, espera mejor a las 7" → corrige HORA. 1 reminder "Llamar a mi mamá" 19:00. supersedesPrevious:true, finalIntentText:"a las 7".
    - "hoy a las 4 desayuno con Marcia, no perdón, mañana" → corrige FECHA. 1 evento "Desayuno con Marcia" MAÑANA 16:00. supersedesPrevious:true, finalIntentText:"mañana".
    - "mañana doctor a las 5 y recuérdame llevar exámenes, no, mejor llevar la receta" → corrige el OBJETO del sub-recordatorio. 1 evento "Doctor" mañana 17:00 + linkedReminders:[{kind:"checklist_note", text:"Llevar la receta", offsetMinutes:null}]. NO emitir "Llevar los exámenes". supersedesPrevious:true en el sub-recordatorio.
    - "hoy a las 5 gimnasio y a las 8 estudiar, no, estudiar mañana" → corrige FECHA del SEGUNDO evento. 2 eventos: "Gimnasio" hoy 17:00 + "Estudiar" MAÑANA 20:00. Solo el segundo lleva supersedesPrevious:true.
    - "tengo reunión con Juan Pablo a las 12, perdón a las 12:30" → corrige HORA. 1 evento "Reunión con Juan Pablo" 12:30.

    DIFERENCIA CLAVE — "también" NO es corrección:
    - "llevar exámenes y receta" → 2 sub-recordatorios. AMBOS sourceText, supersedesPrevious:false.
    - "llevar exámenes, no, mejor receta" → 1 sub-recordatorio "Llevar la receta", supersedesPrevious:true.
    - "fútbol a las 4 y a las 5 estudiar" → 2 eventos distintos (Fútbol 16:00, Estudiar 17:00).
    - "fútbol a las 4, no mejor a las 5" → 1 evento Fútbol 17:00.

    SI LA CORRECCIÓN ES AMBIGUA:
    - "a las 5, no, mejor más tarde" → no hay hora final concreta → emite clarify con clarificationQuestion:"¿A qué hora exacta lo dejamos?".
    - "doctor mañana, no, mejor el viernes" → si la fecha "el viernes" es interpretable del mapa de semana → usar esa. Si no → clarify.

DEVUELVE EXCLUSIVAMENTE el JSON del schema. Sin texto fuera del objeto.`
}

// ─── Defensas (compartidas con validator) ───────────────────────────────────

const BARE_GARBAGE_TITLES = new Set([
  'hora', 'horas', 'hoy', 'mañana', 'manana',
  'evento', 'recordatorio', 'tarea', 'tarea sin título',
  'a las', 'a las 5', 'ev', 'rec', '...', '',
])
const GENERIC_NEEDS_CONTEXT = new Set([
  'reunión', 'reunion', 'clase', 'trabajo', 'tarea',
])

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

function normForCompare(s) {
  if (typeof s !== 'string') return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:]+\s*$/, '')
    .trim()
}

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

// ─── Conversión raw → Action[] semánticas ────────────────────────────────────

/**
 * Expande las actions raw de OpenAI a `Action[]` SEMÁNTICAS para el
 * contrato Nova Core: separa los `linkedReminders[]` en
 * `create_linked_reminder` (offset_action) y `create_linked_sub_reminder`
 * (checklist_note), cada uno con `parentActionId` apuntando al evento.
 *
 * Esta es la representación LIMPIA del intent del usuario y es la que
 * el validator inspecciona y el logger registra.
 *
 * Defensas (anti-basura / anti-contaminación / confidence:low) ya
 * descartan acciones en el caller (validator + adapter run).
 */
export function expandToSemanticActions(rawActions) {
  const out = []
  let idCounter = 0
  const nextId = (prefix) => {
    idCounter += 1
    return `${prefix}-${idCounter}`
  }

  for (const a of (Array.isArray(rawActions) ? rawActions : [])) {
    if (!a || typeof a !== 'object') continue

    if (a.type === 'clarify') {
      out.push({
        type: 'clarify',
        clarificationQuestion: typeof a.title === 'string' ? a.title : null,
        sourceText: typeof a.sourceText === 'string' ? a.sourceText : '',
        confidence: a.confidence || 'low',
      })
      continue
    }

    if (a.type === 'create_event') {
      const eventId = nextId('evt')
      const linkedReminders = Array.isArray(a.linkedReminders) ? a.linkedReminders : []
      out.push({
        type: 'create_event',
        id: eventId,
        title: a.title,
        dateISO: a.dateISO,
        dateText: a.dateText,
        time: a.time,
        durationMinutes: a.durationMinutes,
        category: a.category,
        reminderOffsetMinutes: a.reminderOffsetMinutes,
        sourceText: a.sourceText,
        confidence: a.confidence,
        supersedesPrevious: a.supersedesPrevious === true,
        finalIntentText: typeof a.finalIntentText === 'string' ? a.finalIntentText : a.sourceText,
      })
      // Linked reminders separados como entidades semánticas.
      const baseOffsetAction = linkedReminders.find(
        l => l && l.kind === 'offset_action' &&
             typeof l.offsetMinutes === 'number' && l.offsetMinutes >= 0 &&
             typeof l.text === 'string' && l.text.trim().length > 0,
      )
      const fallbackOffset = baseOffsetAction ? baseOffsetAction.offsetMinutes : 0
      for (const l of linkedReminders) {
        if (!l || typeof l.text !== 'string') continue
        const txt = l.text.trim()
        if (txt.length === 0) continue
        const off = (typeof l.offsetMinutes === 'number' && l.offsetMinutes >= 0)
          ? l.offsetMinutes
          : fallbackOffset
        const isOffsetAction = l.kind === 'offset_action'
        out.push({
          type: isOffsetAction ? 'create_linked_reminder' : 'create_linked_sub_reminder',
          id: nextId(isOffsetAction ? 'lr' : 'ls'),
          parentActionId: eventId,
          offsetMinutes: off,
          text: txt,
          // notificationTitle/Body se construyen en el adapter iOS o
          // en el LocalNotificationService — acá los dejamos null porque
          // dependen del evento padre y del fireDate. El cliente iOS
          // los arma en `toImperative()`.
          notificationTitle: null,
          notificationBody: null,
          sourceText: a.sourceText,
          confidence: a.confidence,
          // El sub-recordatorio HEREDA el flag del padre — si el padre
          // fue corregido, todo el conjunto es la versión final.
          supersedesPrevious: a.supersedesPrevious === true,
          finalIntentText: typeof a.finalIntentText === 'string' ? a.finalIntentText : a.sourceText,
        })
      }
      continue
    }

    if (a.type === 'create_reminder') {
      out.push({
        type: 'create_reminder',
        id: nextId('rem'),
        title: a.title,
        dateISO: a.dateISO,
        dateText: a.dateText,
        time: a.time,
        sourceText: a.sourceText,
        confidence: a.confidence,
        supersedesPrevious: a.supersedesPrevious === true,
        finalIntentText: typeof a.finalIntentText === 'string' ? a.finalIntentText : a.sourceText,
      })
      continue
    }

    // Type desconocido — lo ignoramos silenciosamente (no podemos colapsar
    // algo que no conocemos). El validator ya bloquea esto antes.
  }

  return out
}

// ─── Colapso Action[] semánticas → BackendAction[] iOS ──────────────────────

/**
 * Toma las actions semánticas (después del validator) y construye la
 * respuesta que el cliente iOS espera. iOS no fue tocado: sigue
 * consumiendo `{type:'add_event', event:{...}}` con `reminderOffsets[]`
 * + `reminderNotes[]` dentro del evento padre.
 *
 * Recibe también `reqId` para los `_meta` de cada action y `inputMessage`
 * porque ya estuvo validado el sourceText contra él.
 */
export function collapseSemanticToBackendActions(semanticActions, { reqId, inputMessage } = {}) {
  const inputNorm = normForCompare(inputMessage || '')
  const safeActions = []
  const droppedReasons = []
  const clarifications = []

  // Indexar linked-* por parentActionId para colapsar a su evento.
  const linkedByParent = new Map()
  for (const a of semanticActions) {
    if (a.type === 'create_linked_reminder' || a.type === 'create_linked_sub_reminder') {
      const arr = linkedByParent.get(a.parentActionId) || []
      arr.push(a)
      linkedByParent.set(a.parentActionId, arr)
    }
  }

  for (const a of semanticActions) {
    if (a.type === 'clarify') {
      if (a.clarificationQuestion) clarifications.push(a.clarificationQuestion)
      continue
    }
    if (a.type === 'create_linked_reminder' || a.type === 'create_linked_sub_reminder') {
      // Ya se procesan dentro del padre.
      continue
    }

    const titleRaw = typeof a.title === 'string' ? a.title.trim() : ''
    if (titleRaw.length === 0) {
      droppedReasons.push('title vacío')
      continue
    }
    const titleLower = titleRaw.toLowerCase()
    if (BARE_GARBAGE_TITLES.has(titleLower)) {
      droppedReasons.push(`title basura: "${titleRaw}"`)
      continue
    }
    if (GENERIC_NEEDS_CONTEXT.has(titleLower) && titleRaw.split(/\s+/).length <= 1) {
      droppedReasons.push(`title genérico sin contexto: "${titleRaw}"`)
      continue
    }
    if (/^\d{1,2}(:\d{2})?$/.test(titleRaw)) {
      droppedReasons.push(`title es solo hora: "${titleRaw}"`)
      continue
    }

    // Anti-contaminación por corrección — el LLM a veces emite el título
    // mezclado con el trigger ("Futbol , no no mejor"). Cualquier match
    // de los siguientes triggers en lowercase descarta la action; el caller
    // emite clarify pidiendo que el usuario lo diga de nuevo.
    const titleNormForTriggers = titleRaw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    const TITLE_TRIGGERS = [
      /\bno\s+no\b/, /\bno\s+mejor\b/, /\bno,?\s*mejor\b/,
      /\bespera\b/, /\bperd[oó]n\b/, /\bmejor\s+a\s+las\b/,
      /\bmejor\s+el\b/, /\bmejor\s+hazlo\b/,
      /\bme\s+equivoqu[eé]\b/, /\bolvida\s+eso\b/,
      /\beso\s+no\b/, /\bal\s+final\b/, /\ben\s+realidad\b/,
    ]
    const triggerHit = TITLE_TRIGGERS.find(re => re.test(titleNormForTriggers))
    if (triggerHit) {
      droppedReasons.push(`title contaminado por trigger de corrección: "${titleRaw}"`)
      clarifications.push(`No entendí bien lo que quieres cambiar. ¿Me lo dices de nuevo en una frase corta?`)
      continue
    }

    // sourceText debe aparecer en el input (defensa anti-contaminación).
    const src = typeof a.sourceText === 'string' ? a.sourceText : ''
    if (src.trim().length > 0) {
      const srcNorm = normForCompare(src)
      const found = srcNorm.length >= 4 && inputNorm.includes(srcNorm.slice(0, Math.max(4, Math.min(20, srcNorm.length))))
      const titleKey = normForCompare(titleRaw.split(/\s+/)[0] || '')
      const titleAppears = titleKey.length >= 3 && inputNorm.includes(titleKey)
      if (!found && !titleAppears) {
        droppedReasons.push(`contaminación: sourceText "${src}" ni título "${titleRaw}" en input`)
        continue
      }
    }

    if (a.confidence === 'low') {
      droppedReasons.push(`confidence low: "${titleRaw}"`)
      clarifications.push(`No me quedó claro lo de "${titleRaw}". ¿Me das más detalle?`)
      continue
    }

    const isReminder = a.type === 'create_reminder'
    const time12 = timeStringTo12h(a.time)
    const date = typeof a.dateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dateISO) ? a.dateISO : null
    const cat = (typeof a.category === 'string' && CATEGORY_TO_ICON[a.category]) ? a.category : 'otro'

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

    const event = {
      title: titleRaw,
      // Reminders SÍ llevan time cuando el usuario lo especifica
      // ("recuérdame llamar a las 7" → 19:00). Antes se forzaba a null
      // por legacy, perdiendo el bump AM/PM que aplicaba core.js. Si el
      // LLM no proveyó time, queda null igual.
      time: time12,
      endTime,
      date,
      section: isReminder ? 'evening' : (CATEGORY_TO_SECTION[cat] || 'evening'),
      icon: isReminder ? 'alarm' : (CATEGORY_TO_ICON[cat] || 'event'),
    }

    // Colapsar linked-* del mismo padre a arrays paralelos reminderOffsets/reminderNotes.
    // Mantiene cada entry separada (1 entry por sub-nota) para que iOS pueda
    // renderizarlas como bullets indentados; LocalNotificationService dedupea
    // por fireDate cuando dispara la notif.
    if (!isReminder) {
      const linked = linkedByParent.get(a.id) || []
      if (linked.length > 0) {
        const offsets = []
        const notes = []
        for (const l of linked) {
          if (typeof l.text !== 'string' || l.text.trim().length === 0) continue
          offsets.push(typeof l.offsetMinutes === 'number' ? l.offsetMinutes : 0)
          notes.push(l.text.trim())
        }
        if (offsets.length > 0) {
          event.reminderOffsets = offsets
          event.reminderNotes = notes
        }
      } else if (typeof a.reminderOffsetMinutes === 'number' && a.reminderOffsetMinutes >= 0) {
        event.reminderOffsets = [a.reminderOffsetMinutes]
      }
    }

    safeActions.push({
      type: 'add_event',
      event,
      _meta: {
        provider: 'openai',
        sourceText: src,
        confidence: a.confidence,
        reqId,
      },
    })
  }

  return { safeActions, droppedReasons, clarifications }
}

/**
 * Wrapper que mantiene la firma histórica de `openaiNova.js`. Llamado por
 * el shim `openaiNova.js` y por los 30 tests existentes. Internamente:
 *   1. expand → actions semánticas
 *   2. collapse → BackendAction[] iOS
 *   3. arma la response shape que iOS conoce.
 *
 * NO incluye el validator global (validador opera ANTES de llegar acá en
 * el flow nuevo via core.js). Para mantener compat con tests, replicamos
 * las defensas anti-basura dentro del collapse — igual que antes.
 */
export function convertOpenAIToBackendResponse({ openaiPayload, userMessage, reqId }) {
  const raw = openaiPayload || {}
  const semantic = expandToSemanticActions(Array.isArray(raw.actions) ? raw.actions : [])
  const { safeActions, droppedReasons, clarifications } = collapseSemanticToBackendActions(
    semantic,
    { reqId, inputMessage: userMessage },
  )

  let confNum = 1.0
  if (safeActions.length > 0) {
    const considered = semantic.filter(a =>
      a.type === 'create_event' || a.type === 'create_reminder',
    )
    if (considered.length > 0) {
      const total = considered.reduce((acc, a) => acc + (CONFIDENCE_NUMERIC[a.confidence] || 0.5), 0)
      confNum = total / considered.length
    }
  }

  const needsClarification = Boolean(raw.needsClarification) || clarifications.length > 0
  const baseReply = typeof raw.userConfirmationText === 'string' ? raw.userConfirmationText : ''
  let reply = baseReply
  if (needsClarification && clarifications.length > 0) {
    const q = (raw.clarificationQuestion && raw.clarificationQuestion) || clarifications[0]
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
