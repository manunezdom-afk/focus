// Nova Core — local parser.
//
// Detecta intents simples sin necesidad de llamar al LLM:
//   - "qué tengo hoy", "qué hay hoy", "muéstrame mi día" → review_today
//   - "qué tengo mañana", "qué hay mañana" → review_pending (mañana)
//   - saludos puros sin contenido accionable → chat_only
//
// El usuario fue explícito: "qué tengo hoy" NO debe gastar GPT-5.5.
//
// Si el patrón no matchea, devuelve null y el caller (core.js) delega
// la frase al routing OpenAI.

const REVIEW_TODAY_PATTERNS = [
  /\bqu[eé]\s+(?:tengo|hay|ten[ií]a|tendr[eé])\s+hoy\b/i,
  /\bmu[eé]strame\s+mi\s+d[ií]a\b/i,
  /^\s*mi\s+d[ií]a\s*[?!.]?\s*$/i,
  /^\s*(?:c[oó]mo|qu[eé]\s+tal)\s+(?:est[aá]|va|viene|se\s+ve)\s+mi\s+d[ií]a\b/i,
  /\bd[ií]game\s+(?:lo\s+que|qu[eé])\s+tengo\s+hoy\b/i,
  /\bresumen?\s+de\s+hoy\b/i,
  /\bagenda\s+de\s+hoy\b/i,
  /^\s*hoy\s*[?!.]?\s*$/i,
]

const REVIEW_TOMORROW_PATTERNS = [
  /\bqu[eé]\s+(?:tengo|hay|ten[ií]a|tendr[eé])\s+ma[ñn]ana\b/i,
  /\bagenda\s+de\s+ma[ñn]ana\b/i,
  /\bresumen?\s+de\s+ma[ñn]ana\b/i,
]

const GREETING_PATTERNS = [
  /^\s*(?:hola|qu[eé]\s+tal|buenas|buen[oa]s?\s+(?:d[ií]as?|tardes?|noches?))\s*[!.?]*\s*$/i,
  /^\s*(?:gracias|muchas\s+gracias)\s*[!.?]*\s*$/i,
]

/**
 * Devuelve un objeto con la respuesta ya armada si matchea, o null si
 * no matchea ningún patrón local.
 *
 * Shape devuelto (acotado — el caller ensancha al contrato Nova Core):
 *   {
 *     actions: [{ type: 'review_today' | 'review_pending' | 'chat_only' }],
 *     intent: 'review_today' | 'review_pending' | 'chat',
 *     userConfirmationText: string,
 *   }
 */
export function tryLocalParse(message) {
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  if (trimmed.length === 0) return null

  for (const re of REVIEW_TODAY_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        actions: [{ type: 'review_today' }],
        intent: 'review_today',
        userConfirmationText: 'Te muestro lo que tienes hoy.',
      }
    }
  }
  for (const re of REVIEW_TOMORROW_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        actions: [{ type: 'review_pending', when: 'tomorrow' }],
        intent: 'review_pending',
        userConfirmationText: 'Te muestro lo que tienes mañana.',
      }
    }
  }
  for (const re of GREETING_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        actions: [{ type: 'chat_only' }],
        intent: 'chat',
        userConfirmationText: 'Hola. ¿Qué te ayudo a ordenar?',
      }
    }
  }
  return null
}
