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

      // Anti-contaminación por trigger de corrección dentro del título.
      // Si el usuario dijo "fútbol a las 4, no no mejor a las 5", el modelo
      // a veces emite título "Futbol , no no mejor" (literal). Detectamos
      // esto buscando triggers como "no no", "no mejor", "espera", "perdón",
      // "mejor a las", "mejor el" dentro del título — siempre son basura.
      const titleNorm = normForCompare(titleRaw)
      const TITLE_CONTAMINATION = [
        /\bno\s+no\b/, /\bno\s+mejor\b/, /\bno,?\s*mejor\b/,
        /\bespera\b/, /\bperd[oó]n\b/, /\bmejor\s+a\s+las\b/,
        /\bmejor\s+el\b/, /\bmejor\s+hazlo\b/,
        /\bme\s+equivoqu[eé]\b/, /\bolvida\s+eso\b/,
        /\beso\s+no\b/, /\bal\s+final\b/, /\ben\s+realidad\b/,
      ]
      const dirty = TITLE_CONTAMINATION.find(re => re.test(titleNorm))
      if (dirty) {
        errors.push(`correcci[oó]n descartada filtrada en título: "${titleRaw}" (matchea ${dirty})`)
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
 *  - conflictos de corrección (mismo título base, distintas horas) → strong
 *  - solo "type desconocido" o "sin parent" → strong no va a arreglar
 */
export function shouldRetryWithStrong(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return false
  const retryable = errors.some(e =>
    /basura|contaminación|genérico|solo hora|hoy \(|mañana \(|sourceText vacío|sin t[íi]tulo|correcci[oó]n descartada/.test(e),
  )
  return retryable
}

// ─── Correcciones humanas — defensa en profundidad ─────────────────────────

// Triggers que indican que el usuario se corrigió a mitad de mensaje.
// Si alguno está en el input, exigimos que las actions reflejen la
// intención FINAL — no duplicados con la versión descartada.
const CORRECTION_TRIGGERS = [
  /\bno\s+no\b/i, /\bno,\s*no\b/i,
  /\bno,?\s*mejor\b/i, /\bmejor\s+a\s+las\b/i, /\bmejor\s+el\b/i, /\bmejor\s+hazlo\b/i,
  /\bespera\b/i, /\bespera\s+mejor\b/i,
  /\bperd[oó]n\b/i, /\bperdona\b/i,
  /\bme\s+equivoqu[eé](?:\s|,|\.|$)/i,
  /\bal\s+final\b/i, /\ben\s+realidad\b/i, /\bla\s+verdad\b/i,
  /\bc[aá]mbialo\s+a\b/i, /\bcambia\s+eso\s+por\b/i, /\bcambia\s+a\b/i,
  /\bno,?\s+era\b/i, /\bno\s+era\s+eso\b/i,
  /\bd[eé]jalo\b/i,
  /\bolvida\s+eso\b/i, /\bolv[ií]date\s+de\s+eso\b/i, /\beso\s+no\b/i,
]

/**
 * True si el input contiene un trigger de corrección humana.
 */
export function inputHasCorrection(userMessage) {
  if (typeof userMessage !== 'string') return false
  return CORRECTION_TRIGGERS.some(re => re.test(userMessage))
}

/**
 * Stem mínimo del título para detectar duplicados que pueden ser corrección
 * de la misma cosa ("Fútbol" en 2 events distintos). Lowercase + sin tildes
 * + primer token significativo.
 */
function titleStem(title) {
  if (typeof title !== 'string') return ''
  const norm = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  const first = norm.split(/\s+/)[0] || ''
  return first
}

/**
 * Detecta y resuelve conflictos de corrección.
 *
 * Si el input tiene un trigger de corrección Y hay 2+ create_event/create_reminder
 * con el MISMO stem-title y DISTINTA hora o fecha, asumimos que el LLM
 * no descartó la versión vieja como debió. Nos quedamos con la ÚLTIMA
 * (la que aparece más tarde en el array, que es la versión post-corrección
 * según el orden natural del prompt).
 *
 * Devuelve:
 *   {
 *     resolved: Action[],        // lista limpia (sin duplicados)
 *     removed: { id, reason }[], // qué se descartó y por qué
 *     conflicts: number,         // cuántos conflictos resolvió
 *   }
 *
 * Si NO hay correction trigger en el input, devuelve actions sin tocar.
 */
export function resolveCorrectionConflicts(actions, { userMessage } = {}) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { resolved: actions || [], removed: [], conflicts: 0 }
  }
  if (!inputHasCorrection(userMessage)) {
    return { resolved: actions, removed: [], conflicts: 0 }
  }

  // Agrupar por stem-title los create_event y create_reminder.
  const byStem = new Map() // stem -> array of {index, action}
  for (let i = 0; i < actions.length; i += 1) {
    const a = actions[i]
    if (!a || (a.type !== 'create_event' && a.type !== 'create_reminder')) continue
    const stem = titleStem(a.title)
    if (!stem) continue
    const arr = byStem.get(stem) || []
    arr.push({ index: i, action: a })
    byStem.set(stem, arr)
  }

  const drops = new Set() // indices a remover (del array original)
  const removed = []

  for (const [stem, group] of byStem) {
    if (group.length < 2) continue
    // Hay ≥2 con mismo stem. Si difieren en hora o fecha, descartamos
    // todas menos la última (orden del array = orden temporal en el
    // input). Si todas tienen igual hora y fecha, no es corrección —
    // es un duplicado de Nova que el collapse iOS va a deduplicar de
    // todas formas; lo dejamos.
    const distinct = new Set(group.map(g => `${g.action.dateISO || ''}|${g.action.time || ''}`))
    if (distinct.size < 2) continue
    const keepIdx = group[group.length - 1].index
    for (const g of group) {
      if (g.index !== keepIdx) {
        drops.add(g.index)
        removed.push({
          id: g.action.id,
          reason: `corrección descartada: "${g.action.title}" ${g.action.time || ''} (stem "${stem}", se quedó la versión final)`,
        })
      }
    }
  }

  if (drops.size === 0) {
    return { resolved: actions, removed: [], conflicts: 0 }
  }

  // Construir resolved: filtrar events/reminders descartados, y ARRASTRAR
  // los linked-reminders huérfanos (su parent ya no existe → también
  // descartar para no dejar zombies).
  const survivingEventIds = new Set()
  const resolved = []
  for (let i = 0; i < actions.length; i += 1) {
    if (drops.has(i)) continue
    const a = actions[i]
    if (a.type === 'create_event') survivingEventIds.add(a.id)
    resolved.push(a)
  }
  // Segunda pasada: quitar linked-* huérfanos.
  const final = resolved.filter(a => {
    if (a.type !== 'create_linked_reminder' && a.type !== 'create_linked_sub_reminder') return true
    if (survivingEventIds.has(a.parentActionId)) return true
    removed.push({
      id: a.id,
      reason: `linked-reminder huérfano (parent descartado por corrección)`,
    })
    return false
  })

  return { resolved: final, removed, conflicts: drops.size }
}
