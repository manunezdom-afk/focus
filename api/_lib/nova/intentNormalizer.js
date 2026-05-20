// Nova Core — Human Intent Normalization (pre-LLM).
//
// Pre-procesa el input ANTES de mandarlo a OpenAI. Cuando el usuario se
// corrige a mitad de mensaje ("no no mejor a las 5"), reescribe el input
// para que el LLM solo vea la versión final. Esto cubre los casos en los
// que el modelo (cheap o strong) ignora la regla 11 del prompt y emite
// la versión vieja o un título contaminado.
//
// Es heurística — patterns concretos cubriendo los 5 escenarios canónicos
// del usuario. Si no matchea, devuelve el input intacto y deja que el LLM
// haga su trabajo normal.
//
// Logs cada normalización con before/after para debugging.

const RULES = [
  // 1. "a las X, no no mejor a las Y" / "a las X, mejor a las Y" /
  //    "a las X, espera mejor a las Y" → "a las Y"
  //    También cubre "perdón a las Y".
  {
    name: 'hora-replace',
    pattern: /\ba\s+las\s+(\d{1,2}(?::\d{2})?)\s*[,]?\s*(?:no\s+no\s+|no,?\s*|espera\s+|perd[oó]n\s+|al\s+final\s+|en\s+realidad\s+)?mejor\s+a\s+las\s+(\d{1,2}(?::\d{2})?)\b/i,
    replacement: 'a las $2',
  },
  // 2. "a las X, perdón a las Y" / "a las X, perdón, a las Y"
  {
    name: 'hora-perdon',
    pattern: /\ba\s+las\s+(\d{1,2}(?::\d{2})?)\s*[,]?\s*perd[oó]n[,]?\s+a\s+las\s+(\d{1,2}(?::\d{2})?)\b/i,
    replacement: 'a las $2',
  },
  // 3. "hoy/mañana X, no perdón, mañana/hoy/<día>" → "<día> X"
  //    Caso: "hoy a las 4 desayuno con Marcia, no perdón, mañana" →
  //          "mañana a las 4 desayuno con Marcia"
  {
    name: 'fecha-perdon',
    pattern: /\b(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b(.*?)(?:,?\s+(?:no\s+)?perd[oó]n[,]?\s+|[,]?\s+(?:no\s+)?mejor\s+|[,]?\s+espera\s+)(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b/i,
    replacement: '$3$2',
  },
  // 4. "X estudiar/Y, no, estudiar mañana" — corrige FECHA de un evento
  //    específico en multi-evento. Reescribe insertando "mañana" cerca
  //    del verbo afectado. Caso: "hoy a las 5 gimnasio y a las 8 estudiar,
  //    no, estudiar mañana" → "hoy a las 5 gimnasio y a las 8 estudiar mañana"
  {
    name: 'fecha-evento',
    pattern: /\b(\w+)\s*,\s*no,?\s+\1\s+(hoy|ma[ñn]ana|el\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))\b/i,
    replacement: '$1 $2',
  },
  // 5. Objeto a llevar corregido: "llevar X, no, mejor llevar Y" → "llevar Y"
  {
    name: 'objeto-correccion',
    pattern: /\bllevar\s+([^,]+?)\s*,\s*no,?\s+(?:mejor\s+)?(?:llevar\s+)?([^,]+?)(?=$|[,.;])/i,
    replacement: 'llevar $2',
  },
]

/**
 * Aplica las reglas de normalización en orden. Devuelve `{ normalized,
 * applied: ruleName[] }`. Si nada matcheó, normalized === input y applied
 * es vacío.
 *
 * Las reglas son IDEMPOTENTES y se aplican una vez cada una. Si dos reglas
 * podrían afectar el mismo span, la primera tiene precedencia.
 */
export function normalizeCorrections(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return { normalized: input, applied: [] }
  }
  let current = input
  const applied = []
  for (const rule of RULES) {
    const before = current
    const after = current.replace(rule.pattern, rule.replacement)
    if (after !== before) {
      current = after
      applied.push(rule.name)
    }
  }
  // Limpieza final: espacios duplicados, comas sobrantes.
  current = current.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim()
  return { normalized: current, applied }
}
