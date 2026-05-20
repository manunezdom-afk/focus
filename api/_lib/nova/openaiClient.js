// Nova Core — cliente HTTP OpenAI.
//
// Capa MUY delgada: arma el body de Responses API con el schema que recibe,
// hace fetch, devuelve el JSON. La interpretación del payload (extraer
// texto, convertir a contrato semántico) vive en `adapters/focus.js`.
//
// Esta separación es intencional: si mañana Kairos o Spark usan otro
// schema (resúmenes, flashcards, etc.), reusan este cliente sin tocarlo.

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_TIMEOUT_MS = 45_000

/**
 * Llama Responses API de OpenAI con un schema strict.
 * Lanza un Error con `.status` = código HTTP si la respuesta no es 2xx.
 * El caller (core.js) interpreta `status === 404` como "modelo inexistente"
 * y dispara el fallback al modelo strong.
 */
export async function callOpenAI({ message, systemPrompt, model, schema, apiKey, reqId, signal }) {
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY no está configurado en el environment')
    err.status = 500
    throw err
  }
  if (!schema) {
    throw new Error('callOpenAI requiere schema')
  }

  const body = {
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    text: {
      format: {
        type: 'json_schema',
        ...schema,
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
      err.bodyText = errText
      throw err
    }

    return await response.json()
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * Extrae el texto JSON del payload de Responses API. Soporta ambos shapes
 * que OpenAI ha usado: `output_text` (atajo) y `output[].content[].text`.
 * Lanza si no encuentra texto — caller debe atrapar y disparar clarify.
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

/**
 * Resuelve qué modelo usar según ruta + envs. Devuelve un string concreto.
 *  - `cheap` → OPENAI_NOVA_CHEAP_MODEL (default 'gpt-5.4-mini')
 *  - `strong` → OPENAI_NOVA_STRONG_MODEL (default 'gpt-5.5')
 *  - `default` → OPENAI_NOVA_DEFAULT_MODEL (default cheap)
 * Si la env existe y está vacía, igual aplica el default.
 */
export function resolveModelName(tier) {
  const cheap = (process.env.OPENAI_NOVA_CHEAP_MODEL || 'gpt-5.4-mini').trim()
  const strong = (process.env.OPENAI_NOVA_STRONG_MODEL || 'gpt-5.5').trim()
  if (tier === 'cheap') return cheap || 'gpt-5.4-mini'
  if (tier === 'strong') return strong || 'gpt-5.5'
  // default
  const def = (process.env.OPENAI_NOVA_DEFAULT_MODEL || cheap).trim()
  return def || cheap || 'gpt-5.4-mini'
}
