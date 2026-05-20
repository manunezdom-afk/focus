// Nova Core — router.
//
// Decide qué modelo (o ningún modelo) usar para un mensaje dado. La
// heurística es CONSERVADORA: prefiere mandar a strong (gpt-5.5) frente
// a casos ambiguos, pero por DEFAULT manda casos simples al cheap
// (gpt-5.4-mini) para reducir costo.
//
// Es estrictamente heurística — no llama OpenAI, no toca DB. Si fallar
// la decisión, el flujo cae igual al fallback strong en core.js.

import { tryLocalParse } from './localParser.js'

// Conectores fuertes que indican multi-acción → strong directo.
// Mantenido en sync con `detectComplexInput` en focus-assistant.js.
const STRONG_HINTS = [
  ' y luego ', ' y después ', ' y despues ',
  ' luego ', ' después de eso ', ' despues de eso ',
  ' después ', ' despues ',
  ' también ', ' tambien ',
  ' además ', ' ademas ',
  ' más tarde ', ' mas tarde ',
  ' y recuérdame ', ' y recuerdame ', ' y recordame ',
  ' y acuérdame ', ' y acuerdame ', ' y acordame ',
  ' y avísame ', ' y avisame ',
  ' y que no se me olvide ', ' y que no se olvide ',
  ' y no te olvides ', ' y no olvides ', ' y no me dejes olvidar ',
  ' y ponme ', ' y ponle ',
]

// Triggers de recordatorio vinculado → linkedReminders requiere strong
// para que matching semántico (zapatos→deporte, exámenes→salud) funcione.
const LINKED_REMINDER_TRIGGERS = [
  'llevar', 'echar', 'cargar', 'preparar', 'revisar', 'comprar', 'mandar',
  'enviar', 'recoger', 'no se me olvide', 'no se me queden', 'salir',
  'avisarme', 'avísame', 'avisame',
]

// Correcciones inmediatas — strong tiende a manejarlas mejor.
const CORRECTION_HINTS = [
  ' no no ', ' no, no ', ' espera ', ' mejor ', ' mejor dejalo ',
  ' ya no ', ' ya no quiero ', ' cambia ', ' cambio ',
]

/**
 * @param {object} args
 * @param {string} args.message  Mensaje crudo del usuario.
 * @returns {{
 *   route: 'local' | 'cheap' | 'strong',
 *   reason: string,
 *   localResult: object | null,  // si route='local', el resultado del parser
 * }}
 */
export function decideRoute({ message }) {
  // 1. Local parser primero — la opción más barata.
  const local = tryLocalParse(message)
  if (local) {
    return { route: 'local', reason: 'localParser:' + local.intent, localResult: local }
  }

  const lower = String(message || '').toLowerCase()

  // 2. Conectores fuertes / multi-acción → strong directo.
  for (const h of STRONG_HINTS) {
    if (lower.includes(h)) {
      return { route: 'strong', reason: `strong-hint:${h.trim()}`, localResult: null }
    }
  }

  // 3. Linked reminder triggers + presencia de evento → strong para que
  // el matching semántico funcione (zapatos→deporte, exámenes→salud).
  let triggerHit = null
  for (const t of LINKED_REMINDER_TRIGGERS) {
    const re = new RegExp(`\\b${t}\\b`, 'i')
    if (re.test(lower)) {
      triggerHit = t
      break
    }
  }
  if (triggerHit) {
    const hasEventVerb = /\b(tengo|tiene|agend[ae]|p[oó]nme|ponle|voy a|hay)\b/.test(lower)
    if (hasEventVerb) {
      return { route: 'strong', reason: `linked-reminder:${triggerHit}`, localResult: null }
    }
  }

  // 4. Correcciones inmediatas → strong para que entienda la versión final.
  for (const h of CORRECTION_HINTS) {
    if (lower.includes(h)) {
      return { route: 'strong', reason: `correction-hint:${h.trim()}`, localResult: null }
    }
  }

  // 5. Mensajes muy largos (> 180 chars) tienden a ser complejos.
  if (lower.length > 180) {
    return { route: 'strong', reason: 'long-input', localResult: null }
  }

  // 6. Default: cheap. Lo común es "tengo X a las Y" — 1 evento, 1 hora.
  return { route: 'cheap', reason: 'simple-default', localResult: null }
}
