import Anthropic from '@anthropic-ai/sdk'
import { rateLimited, clientIp } from './_lib/rateLimit.js'
import { buildWeatherContext } from './_lib/weather.js'
import { buildDateContext } from './_lib/dateContext.js'
import { buildSystemPrompt } from './_lib/systemPrompt.js'
import { safeParseAssistantJSON } from './_lib/neutralize.js'
import { normalizeNovaPersonality } from './_lib/personality.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from './_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from './_supabaseAdmin.js'
import { ACTION_TYPES, checkLimit, getUserPlan, recordUsage } from './_lib/usageLimits.js'
import { trackAIUsageEvent } from './_lib/aiUsageTracking.js'

const MODEL_ID = 'claude-haiku-4-5-20251001'

// Necesario en Pro plan: por defecto Vercel mata la función a los 10s, lo
// cual era menor que el timeout de 25s del SDK de Anthropic — el handler
// moría sin responder y el cliente quedaba en "Focus está pensando…".
// En Hobby Vercel ignora valores >10s y mantiene 10s. En Pro respeta 60s.
export const maxDuration = 60

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  // Cinturón de seguridad #1: rate limit IP (defensa contra burst). El user
  // limit más fino llega después, una vez identificado el usuario.
  if (rateLimited(clientIp(req), { max: 30, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limit', message: 'Demasiadas solicitudes. Espera un momento.' })
  }

  // Auth obligatoria: sin Bearer válido devolvemos 401. Antes este endpoint
  // aceptaba requests sin sesión "para pruebas en iOS sin cuenta", pero eso
  // exponía la cuota de Anthropic a cualquiera que descubriera la URL — un
  // atacante podía vaciar el presupuesto de la API en minutos.
  const userId = await getUserIdFromAuth(req)
  if (!userId) {
    return res.status(401).json({
      error: 'auth_required',
      message: 'Inicia sesión para hablar con Nova.',
    })
  }

  // Cuota por plan: chequeamos nova_message ANTES de gastar tokens. La
  // verificación es read-only; el contador se incrementa después de que
  // Anthropic respondió OK, así un timeout o caída no quema cuota.
  const admin = getSupabaseAdmin()
  const plan = await getUserPlan(admin, userId)
  const messageCheck = await checkLimit(admin, userId, plan, ACTION_TYPES.NOVA_MESSAGE)
  if (!messageCheck.ok) {
    return res.status(429).json({
      error: 'quota_exceeded',
      action_type: messageCheck.action_type,
      plan: messageCheck.plan,
      period: messageCheck.period,
      used: messageCheck.used,
      limit: messageCheck.limit,
      reset_at: messageCheck.resetAt,
      message: messageCheck.message,
    })
  }

  // Pre-chequeo de smart actions: si no hay cuota, NO bloqueamos el chat
  // — el usuario puede seguir conversando — pero strippeamos las actions
  // del response para no aplicarlas. El frontend muestra un aviso amable.
  const smartCheck = await checkLimit(admin, userId, plan, ACTION_TYPES.NOVA_SMART_ACTION)
  const smartActionsBlocked = !smartCheck.ok

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'no_api_key' })

  const body = req.body || {}
  const { message, location = null, contacts = [], profile = null, behavior = null } = body

  // novaPersonality entra por el body — si el cliente es viejo o manda un
  // valor inválido, normalize() cae al default 'focus' sin romper la request.
  const novaPersonality = normalizeNovaPersonality(body.novaPersonality)

  if (!message?.trim()) return res.status(400).json({ error: 'no_message' })
  if (message.length > 4000) {
    return res.status(400).json({ error: 'message_too_long', message: 'Mensaje demasiado largo (máx 4000 caracteres).' })
  }

  const events = (Array.isArray(body.events) ? body.events : [])
    .filter(e => e && typeof e === 'object' && typeof e.title === 'string' && e.title.trim())
    .slice(0, 200)
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(h => h && typeof h === 'object' && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .slice(-20)
  const memories = (Array.isArray(body.memories) ? body.memories : [])
    .filter(m => m && typeof m === 'object' && typeof m.content === 'string')
    .slice(0, 100)
  const tasks = (Array.isArray(body.tasks) ? body.tasks : [])
    .filter(t => t && typeof t === 'object' && typeof t.label === 'string' && t.label.trim())
    .slice(0, 200)

  const dateContext = buildDateContext(body.clientNow, body.clientTimezone)
  const weatherContext = await buildWeatherContext(location)

  const systemPrompt = buildSystemPrompt({
    dateContext, weatherContext, contacts, profile, behavior, memories, events, tasks,
    novaPersonality,
  })

  // Timeout del SDK 45s para aprovechar maxDuration=60s sin agotarlo. Antes
  // estaba en 25s pero competía con el corte default de Vercel a los 10s,
  // lo que dejaba al cliente colgado en "Focus está pensando…" sin error.
  const anthropic = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 })
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  async function runClaude(extra = '', attempt = 1) {
    const extraMsgs = extra ? [{ role: 'user', content: extra }] : []
    const start = Date.now()
    let response
    try {
      response = await anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [...messages, ...extraMsgs],
      })
    } catch (err) {
      // Registrar el intento fallido también — sin tokens (Anthropic no los
      // devolvió). Útil para distinguir "modelo cayó" de "no se llamó nunca".
      trackAIUsageEvent({
        admin,
        userId,
        action_type: ACTION_TYPES.NOVA_MESSAGE,
        endpoint: 'focus-assistant',
        model: MODEL_ID,
        usage: { input_tokens: 0, output_tokens: 0, source: 'unavailable' },
        success: false,
        error_type: err?.name || 'upstream_error',
        duration_ms: Date.now() - start,
        metadata: { plan, retry_attempt: attempt },
      }).catch(() => {})
      throw err
    }
    // Tracking granular del costo real de esta llamada al modelo.
    trackAIUsageEvent({
      admin,
      userId,
      action_type: ACTION_TYPES.NOVA_MESSAGE,
      endpoint: 'focus-assistant',
      model: response?.model || MODEL_ID,
      anthropicResponse: response,
      success: true,
      duration_ms: Date.now() - start,
      metadata: { plan, retry_attempt: attempt },
    }).catch(() => {})
    return response
  }

  // Procesa la respuesta del modelo, aplica enforcement de smart_action y
  // contabiliza nova_message una sola vez si todo salió bien.
  function finalize(parsed) {
    const out = parsed && typeof parsed === 'object' ? { ...parsed } : { reply: '', actions: [] }
    const actions = Array.isArray(out.actions) ? out.actions : []

    // Si las smart_actions están bloqueadas por cuota: stripeamos las
    // acciones (excepto 'remember' que es transparente y barata) y avisamos
    // al usuario al final del reply para que sepa por qué Nova no actuó.
    let appliedSmartAction = false
    if (smartActionsBlocked && actions.length > 0) {
      const allowed = actions.filter(a => a?.type === 'remember')
      const stripped = actions.length - allowed.length
      out.actions = allowed
      if (stripped > 0) {
        out.smart_actions_blocked = true
        out.smart_actions_message = smartCheck.message
        const note = `\n\n_${smartCheck.message}_`
        out.reply = `${out.reply || ''}${out.reply ? note : smartCheck.message}`
      }
    } else if (actions.length > 0) {
      // Hay acciones reales (excluyendo solo-memoria): sí cuenta como smart_action.
      const realActions = actions.filter(a => a?.type !== 'remember')
      appliedSmartAction = realActions.length > 0
    }

    // Fire-and-forget: no esperamos a que termine el upsert para responder.
    // Si falla, el usuario tuvo su respuesta y el contador queda como está
    // (peor caso: pierde +1 contra sí mismo si la próxima llamada lo cuenta).
    Promise.resolve()
      .then(() => recordUsage(admin, userId, ACTION_TYPES.NOVA_MESSAGE))
      .then(() => appliedSmartAction
        ? recordUsage(admin, userId, ACTION_TYPES.NOVA_SMART_ACTION)
        : null)
      .catch(() => {})

    return res.status(200).json(out)
  }

  try {
    const d1 = await runClaude('', 1)
    const r1 = (d1.content?.[0]?.text ?? '').trim()
    try {
      return finalize(safeParseAssistantJSON(r1))
    } catch {
      const d2 = await runClaude(
        'Tu respuesta anterior tuvo JSON inválido o incompleto. Reintenta ahora. Responde SOLO con un objeto JSON válido siguiendo exactamente el formato indicado. Cierra todas las llaves y corchetes.',
        2,
      )
      const r2 = (d2.content?.[0]?.text ?? '').trim()
      try {
        return finalize(safeParseAssistantJSON(r2))
      } catch {
        // Sin loggear el contenido crudo: incluye datos del usuario
        // (eventos, tareas, memorias) y filtra a Vercel logs. La métrica útil
        // (tasa de fallo) la podemos derivar del status code 502.
        console.error('[focus-assistant] JSON parse failed after retry')
        // Aún si el parse falló dos veces, el modelo SI gastó tokens. Contamos
        // la acción para evitar que un atacante use mensajes mal formateados
        // intencionalmente para bypassear el contador.
        recordUsage(admin, userId, ACTION_TYPES.NOVA_MESSAGE).catch(() => {})
        return res.status(502).json({
          error: 'llm_bad_output',
          reply: 'Tuve un problema procesando la respuesta. Repite el mensaje por favor.',
          actions: [],
        })
      }
    }
  } catch (err) {
    const status = err?.status || err?.response?.status
    if (status === 401) {
      console.error('[focus-assistant] upstream auth failure')
      return res.status(503).json({ error: 'invalid_api_key', message: 'Servicio temporalmente no disponible.' })
    }
    if (status === 429) {
      console.error('[focus-assistant] upstream rate limit')
      return res.status(429).json({ error: 'upstream_rate_limit', message: 'Demasiadas solicitudes. Prueba en unos segundos.' })
    }
    if (status === 529 || status === 503) {
      console.error('[focus-assistant] upstream overloaded')
      return res.status(503).json({ error: 'upstream_overloaded', message: 'El servicio está sobrecargado. Intenta de nuevo.' })
    }
    if (err?.name === 'AbortError' || /timeout/i.test(err?.message || '')) {
      console.error('[focus-assistant] timeout')
      return res.status(504).json({ error: 'timeout', message: 'La respuesta tardó demasiado. Intenta otra vez.' })
    }
    // Loggeamos el tipo de error sin el stack completo: evita filtrar datos
    // serializados en el message del SDK.
    console.error('[focus-assistant] unexpected:', err?.name || 'Error', status || '')
    return res.status(500).json({ error: 'internal_error', message: 'Error interno. Reintenta en un momento.' })
  }
}
