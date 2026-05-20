// Nova Core — validator global.
//
// Opera sobre las actions SEMÁNTICAS (después de expandToSemanticActions
// pero antes de collapseSemanticToBackendActions). Marca acciones inválidas
// con un motivo y deja que core.js decida si vale la pena reintentar con
// el modelo strong o si emite clarify directo.
//
// Reglas de validación (las que el usuario pidió explícitamente):
//  - JSON shape ya garantizado por Structured Outputs de OpenAI; acá solo
//    verificamos campos lógicos.
//  - sourceText presente y ⊂ input (anti-contaminación).
//  - title NO basura ("Horas", "Evento", "Recordatorio", "Reunión" sin
//    contexto, "Hoy", "Mañana", solo dígitos).
//  - "hoy" en el input → dateISO debe ser el todayISO recibido (TZ del
//    cliente). "mañana" → tomorrowISO. Tolerante: si el input no menciona
//    hoy/mañana literal, NO forzamos.
//  - Si hay linkedReminder con parentActionId, ese parent debe existir
//    como create_event en el mismo array.

const BARE_GARBAGE_TITLES = new Set([
  'hora', 'horas', 'hoy', 'mañana', 'manana',
  'evento', 'recordatorio', 'tarea', 'tarea sin título',
  'a las', 'a las 5', 'ev', 'rec', '...', '',
])
const GENERIC_NEEDS_CONTEXT = new Set([
  'reunión', 'reunion', 'clase', 'trabajo', 'tarea',
])

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
 * Valida una lista de actions semánticas contra el input original y el
 * contexto temporal. Devuelve:
 *   {
 *     valid: boolean,   // true si NO hay errores severos
 *     errors: string[], // todos los problemas detectados, en orden
 *     fatal: boolean,   // true si NINGUNA action sobrevive (todo basura)
 *   }
 *
 * El caller decide qué hacer con errores no-fatales:
 *  - core.js con FALLBACK_TO_STRONG → reintenta con strong si hubo error
 *  - sin fallback → deja pasar las que pasaron y descarta el resto en el
 *    collapse final (defensas duplicadas son por diseño).
 */
export function validateSemanticActions(actions, { userMessage, todayISO, tomorrowISO } = {}) {
  const errors = []
  const inputNorm = normForCompare(userMessage || '')
  const mentionsHoy = /\bhoy\b/.test(inputNorm)
  const mentionsManana = /\bma[ñn]ana\b/.test(inputNorm)

  const eventIds = new Set(
    actions
      .filter(a => a.type === 'create_event')
      .map(a => a.id),
  )

  let validCount = 0

  for (const a of (Array.isArray(actions) ? actions : [])) {
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') {
      errors.push('action sin type')
      continue
    }

    if (a.type === 'clarify') {
      validCount += 1 // clarify es válido por definición
      continue
    }

    if (a.type === 'review_today' || a.type === 'review_pending') {
      validCount += 1
      continue
    }

    if (a.type === 'create_event' || a.type === 'create_reminder') {
      const titleRaw = typeof a.title === 'string' ? a.title.trim() : ''
      if (titleRaw.length === 0) {
        errors.push(`${a.type} sin título`)
        continue
      }
      const titleLower = titleRaw.toLowerCase()
      if (BARE_GARBAGE_TITLES.has(titleLower)) {
        errors.push(`título basura: "${titleRaw}"`)
        continue
      }
      if (GENERIC_NEEDS_CONTEXT.has(titleLower) && titleRaw.split(/\s+/).length <= 1) {
        errors.push(`título genérico sin contexto: "${titleRaw}"`)
        continue
      }
      if (/^\d{1,2}(:\d{2})?$/.test(titleRaw)) {
        errors.push(`título es solo hora: "${titleRaw}"`)
        continue
      }

      // sourceText debe aparecer en el input
      const src = typeof a.sourceText === 'string' ? a.sourceText.trim() : ''
      if (src.length === 0) {
        errors.push(`sourceText vacío para "${titleRaw}"`)
        continue
      }
      const srcNorm = normForCompare(src)
      const found = srcNorm.length >= 4 && inputNorm.includes(srcNorm.slice(0, Math.max(4, Math.min(20, srcNorm.length))))
      const titleKey = normForCompare(titleRaw.split(/\s+/)[0] || '')
      const titleAppears = titleKey.length >= 3 && inputNorm.includes(titleKey)
      if (!found && !titleAppears) {
        errors.push(`contaminación: "${src}" ni "${titleRaw}" en input`)
        continue
      }

      // Fechas vs TZ — solo si el usuario mencionó hoy/mañana literal.
      if (mentionsHoy && todayISO && a.dateISO && a.dateISO !== todayISO) {
        errors.push(`dateISO ${a.dateISO} no es hoy (${todayISO}) para "${titleRaw}"`)
      }
      if (mentionsManana && tomorrowISO && a.dateISO && a.dateISO !== tomorrowISO) {
        errors.push(`dateISO ${a.dateISO} no es mañana (${tomorrowISO}) para "${titleRaw}"`)
      }

      validCount += 1
      continue
    }

    if (a.type === 'create_linked_reminder' || a.type === 'create_linked_sub_reminder') {
      // Debe tener parent existente
      if (!a.parentActionId || !eventIds.has(a.parentActionId)) {
        errors.push(`${a.type} sin parent válido (parentActionId=${a.parentActionId})`)
        continue
      }
      if (typeof a.text !== 'string' || a.text.trim().length === 0) {
        errors.push(`${a.type} sin text`)
        continue
      }
      validCount += 1
      continue
    }

    errors.push(`type desconocido: ${a.type}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    fatal: validCount === 0,
  }
}

/**
 * Determina si los errores ameritan reintentar con el modelo strong.
 * Reglas:
 *  - errores de título basura O contaminación → vale la pena strong
 *  - errores de fecha (hoy/mañana mal interpretado) → vale la pena strong
 *  - errores de sourceText vacío → strong puede aclarar
 *  - solo "type desconocido" o "sin parent" → strong no va a arreglar
 */
export function shouldRetryWithStrong(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return false
  const retryable = errors.some(e =>
    /basura|contaminación|genérico|solo hora|hoy \(|mañana \(|sourceText vacío|sin t[íi]tulo/.test(e),
  )
  return retryable
}
