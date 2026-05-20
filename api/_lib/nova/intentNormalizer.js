// Nova Core — Human Intent Normalization (pre-LLM).
//
// Pre-procesa el input ANTES de mandarlo a OpenAI. Dos clases de reescritura:
//
//   1. CORRECCIONES HUMANAS — cuando el usuario se corrige a mitad de
//      mensaje ("no no mejor a las 5"), reescribe para que el LLM solo
//      vea la versión final.
//   2. AM/PM POR HORA VESPERTINA — cuando el usuario dice "a las N" sin
//      AM/PM y N ya pasó hoy en contexto de recordatorio cotidiano,
//      reescribe a formato 24h (N+12) para eliminar ambigüedad antes
//      del LLM. Cubre el bug "a las 7" → LLM emite 09:00 raro.
//
// Es heurística determinística — patterns concretos cubriendo los
// escenarios canónicos. Si no matchea, devuelve el input intacto y
// deja que el LLM haga su trabajo normal.

const CORRECTION_RULES = [
  // 1. "a las X, no no mejor a las Y" / "a las X, mejor a las Y" /
  //    "a las X, espera mejor a las Y" → "a las Y"
  {
    name: 'hora-replace',
    pattern: /\ba\s+las\s+(\d{1,2}(?::\d{2})?)\s*[,]?\s*(?:no\s+no\s+|no,?\s*|espera\s+|perd[oó]n\s+|al\s+final\s+|en\s+realidad\s+)?mejor\s+a\s+las\s+(\d{1,2}(?::\d{2})?)\b/i,
    replacement: 'a las $2',
  },
  {
    name: 'hora-perdon',
    pattern: /\ba\s+las\s+(\d{1,2}(?::\d{2})?)\s*[,]?\s*perd[oó]n[,]?\s+a\s+las\s+(\d{1,2}(?::\d{2})?)\b/i,
    replacement: 'a las $2',
  },
  {
    name: 'fecha-perdon',
    pattern: /\b(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b(.*?)(?:,?\s+(?:no\s+)?perd[oó]n[,]?\s+|[,]?\s+(?:no\s+)?mejor\s+|[,]?\s+espera\s+)(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b/i,
    replacement: '$3$2',
  },
  {
    name: 'fecha-evento',
    pattern: /\b(\w+)\s*,\s*no,?\s+\1\s+(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b/i,
    replacement: '$1 $2',
  },
  {
    name: 'objeto-correccion',
    pattern: /\bllevar\s+([^,]+?)\s*,\s*no,?\s+(?:mejor\s+)?(?:llevar\s+)?([^,]+?)(?=$|[,.;])/i,
    replacement: 'llevar $2',
  },
]

// Indicadores de contexto matutino — si están presentes, NO se asume PM.
const MORNING_HINTS = /\b(ma[ñn]ana|am|de la ma[ñn]ana|temprano|al amanecer|de la madrugada|en la ma[ñn]ana)\b/i
const PM_HINTS = /\b(pm|de la tarde|de la noche|en la tarde|en la noche|tipo|tipo a las)\b/i

/**
 * Reescritura PM determinística para recordatorios cotidianos.
 *
 * Cuando el input dice "recuérdame ... a las N" (o "tengo X a las N")
 * sin AM/PM explícito, y N ≤ 11, y N ya pasó hoy, REESCRIBE a "a las
 * (N+12):00" para que el LLM no tenga ambigüedad.
 *
 * No aplica si:
 *  - Hay hint matinal ("mañana", "temprano", "de la mañana", "AM")
 *  - El input dice "mañana" (otro día) y el evento es de ese día
 *  - N ≥ 12 (ya está en 24h o claramente AM-explícito tipo 11)
 *  - N > currentHour (es futuro hoy, AM válida)
 *
 * Aplica a TODOS los "a las N" sueltos del input, no solo el primero,
 * porque el normalizer de correcciones ya colapsó a una sola hora.
 */
function applyPMHeuristic(input, currentHour) {
  if (typeof currentHour !== 'number' || Number.isNaN(currentHour)) return input
  const hasMorning = MORNING_HINTS.test(input)
  // "mañana" como adverbio de día también es morning hint para reminders
  // (aunque el evento sea para el día siguiente, "a las 7" sin más es AM
  // si "mañana" está cerca). Pero NO aplicamos PM heurística cuando el
  // input habla del día siguiente (porque la hora del día actual no es
  // la referencia para mañana).
  if (hasMorning) return input

  // Solo aplica a inputs que parecen acción de calendario (reminder/evento)
  // — NO toca preguntas o conversación.
  const isActionInput = /\b(recu[eé]rdame|acu[eé]rdame|av[ií]same|tengo|agenda|p[oó]nme|ponle|voy a|hay)\b/i.test(input)
  if (!isActionInput) return input

  // "a las N" suelto, sin minutos (preserva "a las 8:30" intacto).
  return input.replace(/\ba\s+las\s+(\d{1,2})(?!\s*[:.]\s*\d)(?!\s*(?:y\s+(?:media|cuarto)|treinta|quince))\b/gi, (match, n) => {
    const h = parseInt(n, 10)
    if (h >= 12 || h < 1) return match // 12+ ya 24h, 0 raro
    if (h >= currentHour) return match // futuro hoy AM válida
    // Bump a PM con formato HH:00 explícito — el LLM lo respeta porque
    // ya viene en 24h.
    const h24 = h + 12
    return `a las ${h24}:00`
  })
}

/**
 * Aplica las reglas de corrección en orden. Devuelve `{ normalized,
 * applied: ruleName[] }`. Si nada matcheó, normalized === input y
 * applied es vacío.
 *
 * @param {object} [ctx] - Contexto temporal (opcional).
 * @param {string} [ctx.currentTime24] - Hora actual HH:mm para PM heuristic.
 */
export function normalizeCorrections(input, ctx = {}) {
  if (typeof input !== 'string' || input.length === 0) {
    return { normalized: input, applied: [] }
  }
  let current = input
  const applied = []
  for (const rule of CORRECTION_RULES) {
    const before = current
    const after = current.replace(rule.pattern, rule.replacement)
    if (after !== before) {
      current = after
      applied.push(rule.name)
    }
  }
  // Limpieza intermedia: espacios duplicados, comas sobrantes.
  current = current.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim()

  // PM heuristic — aplica DESPUÉS de la corrección, sobre el input ya
  // reducido a la versión final.
  if (ctx.currentTime24) {
    const [curHStr] = ctx.currentTime24.split(':')
    const curH = parseInt(curHStr, 10)
    const beforePM = current
    const afterPM = applyPMHeuristic(current, curH)
    if (afterPM !== beforePM) {
      current = afterPM
      applied.push('pm-heuristic')
    }
  }

  return { normalized: current, applied }
}
