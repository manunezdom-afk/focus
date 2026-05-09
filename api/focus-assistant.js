import Anthropic from '@anthropic-ai/sdk'
import { rateLimited, clientIp } from './_lib/rateLimit.js'
import { buildWeatherContext, fetchWeather, describeWeatherCode } from './_lib/weather.js'
import { buildDateContext } from './_lib/dateContext.js'
import { buildSystemPrompt } from './_lib/systemPrompt.js'
import { safeParseAssistantJSON } from './_lib/neutralize.js'
import { normalizeNovaPersonality } from './_lib/personality.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from './_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from './_supabaseAdmin.js'
import { ACTION_TYPES, checkLimit, getUserPlan, recordUsage } from './_lib/usageLimits.js'
import { trackAIUsageEvent } from './_lib/aiUsageTracking.js'
import { filterCalendarEditActions, strippedEditMessage } from './_lib/calendarIntent.js'

const MODEL_ID = 'claude-haiku-4-5-20251001'
// Sonnet 4.6 = fallback "premium" cuando Haiku falla en escenarios críticos
// (ediciones de calendario sin verbo explícito, JSON inválido tras reintento,
// truncation por max_tokens). Más caro pero solo se usa en ~3-8% de requests.
const FALLBACK_MODEL_ID = 'claude-sonnet-4-6-20251022'

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

  // Modo alterno "today-context": cliente pide el JSON del Resumen ejecutivo
  // (ambient level + summary + weather tip + flags). Vive aquí y no como
  // /api/today-context independiente porque el plan Hobby de Vercel limita
  // a 12 serverless functions. Al consolidar liberamos un slot.
  if (req.body?.mode === 'today-context') {
    return handleTodayContext(req, res, userId)
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

  // runClaude — modelId opcional permite escalar a Sonnet sin duplicar lógica.
  // Cuando se llama con FALLBACK_MODEL_ID, action_type pasa a NOVA_PREMIUM_MESSAGE
  // así ai_usage_events distingue claramente las escalaciones del flujo normal.
  async function runClaude(extra = '', attempt = 1, modelId = MODEL_ID) {
    const isPremium = modelId === FALLBACK_MODEL_ID
    const actionType = isPremium ? ACTION_TYPES.NOVA_PREMIUM_MESSAGE : ACTION_TYPES.NOVA_MESSAGE
    const extraMsgs = extra ? [{ role: 'user', content: extra }] : []
    const start = Date.now()
    let response
    try {
      response = await anthropic.messages.create({
        model: modelId,
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
        action_type: actionType,
        endpoint: 'focus-assistant',
        model: modelId,
        usage: { input_tokens: 0, output_tokens: 0, source: 'unavailable' },
        success: false,
        error_type: err?.name || 'upstream_error',
        duration_ms: Date.now() - start,
        metadata: { plan, retry_attempt: attempt, premium_escalated: isPremium },
      }).catch(() => {})
      throw err
    }
    // Tracking granular del costo real de esta llamada al modelo.
    trackAIUsageEvent({
      admin,
      userId,
      action_type: actionType,
      endpoint: 'focus-assistant',
      model: response?.model || modelId,
      anthropicResponse: response,
      success: true,
      duration_ms: Date.now() - start,
      metadata: { plan, retry_attempt: attempt, premium_escalated: isPremium },
    }).catch(() => {})
    return response
  }

  // Detecta si un response de Haiku necesita escalarse a Sonnet:
  // - hit max_tokens (truncation)
  // - output cerca del límite (1300/1500 tokens — riesgo de respuesta cortada)
  // - filterCalendarEditActions strippeó acciones (Haiku quería editar sin
  //   intent explícito, Sonnet con prompt refinado debería dar mejor add_event)
  function shouldEscalateToSonnet(response, strippedCount) {
    if (response?.stop_reason === 'max_tokens') return true
    const outputTokens = response?.usage?.output_tokens || 0
    if (outputTokens > 1300) return true
    if (strippedCount > 0) return true
    return false
  }

  // Reintenta con Sonnet cuando Haiku tropezó. Mensaje de refuerzo recuerda
  // las reglas duras del system prompt (no editar sin verbo, fecha=hoy si solo
  // hay hora). El user message original sigue en `messages`.
  async function escalateToSonnet() {
    return runClaude(
      'IMPORTANTE: tu respuesta anterior con Haiku falló o emitió ediciones sin que el usuario lo pidiera. Reintenta siguiendo ESTAS REGLAS DURAS:\n' +
        '1) NUNCA uses edit_event/update_event/delete_event a menos que el usuario haya escrito un verbo explícito de edición (mueve, cambia, edita, modifica, reagenda, pásalo, corre, adelanta, atrasa, borra, elimina, cancela, quita).\n' +
        '2) Si el usuario menciona hora sin fecha, date=hoy (sin importar si la hora ya pasó). Si quería otro día, lo dirá ("mañana", "viernes").\n' +
        '3) Eventos similares de OTRO DÍA NO bloquean creación nueva — son eventos distintos.\n' +
        '4) Si dudás entre crear y editar, SIEMPRE elegí add_event.\n' +
        '5) Cierra todas las llaves del JSON; sin texto fuera del objeto.',
      1,
      FALLBACK_MODEL_ID,
    )
  }

  // Procesa la respuesta del modelo, aplica enforcement de smart_action y
  // contabiliza nova_message (+ nova_premium_message si hubo escalación).
  function finalize(parsed, { escalated = false } = {}) {
    const out = parsed && typeof parsed === 'object' ? { ...parsed } : { reply: '', actions: [] }
    let actions = Array.isArray(out.actions) ? out.actions : []

    // Defensa server-side contra ediciones no pedidas (BLOQUE C).
    // Si el usuario NO usó verbos explícitos de edición ("mueve", "cambia",
    // "edita", "borra", etc), strippeamos cualquier edit_event /
    // update_event / delete_event que el modelo haya emitido — el system
    // prompt ya tiene la regla, esto es la red.
    const editFilter = filterCalendarEditActions(actions, message)
    if (editFilter.stripped.length > 0) {
      console.warn(
        '[focus-assistant] stripped edit actions without explicit intent:',
        editFilter.stripped.map(a => a.type).join(','),
      )
      const note = strippedEditMessage(editFilter.stripped)
      out.reply = `${out.reply || ''}${out.reply ? '\n\n' : ''}${note}`
      actions = editFilter.actions
      out.actions = actions
    }

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
    // Cuando hubo escalación a Sonnet, también incrementamos NOVA_PREMIUM_MESSAGE
    // para que las cuotas de la cohort beta puedan verlo separado.
    Promise.resolve()
      .then(() => recordUsage(admin, userId, ACTION_TYPES.NOVA_MESSAGE))
      .then(() => appliedSmartAction
        ? recordUsage(admin, userId, ACTION_TYPES.NOVA_SMART_ACTION)
        : null)
      .then(() => escalated
        ? recordUsage(admin, userId, ACTION_TYPES.NOVA_PREMIUM_MESSAGE)
        : null)
      .catch(() => {})

    return res.status(200).json(out)
  }

  try {
    // PASO 1 — Haiku (modelo barato, cubre 90%+ de los requests).
    const d1 = await runClaude('', 1)
    const r1 = (d1.content?.[0]?.text ?? '').trim()
    let parsed
    try {
      parsed = safeParseAssistantJSON(r1)
    } catch {
      // PASO 2a — JSON inválido: reintenta directamente con Sonnet (Path B).
      // No reintentamos con Haiku porque ya falló al parsear; Sonnet con el
      // prompt de refuerzo suele dar JSON limpio en una sola pasada.
      try {
        const dPremium = await escalateToSonnet()
        const rPremium = (dPremium.content?.[0]?.text ?? '').trim()
        return finalize(safeParseAssistantJSON(rPremium), { escalated: true })
      } catch {
        console.error('[focus-assistant] JSON parse failed after Sonnet escalation')
        // Aún si el parse falló dos veces (Haiku + Sonnet), los modelos SÍ
        // gastaron tokens. Contamos la acción base para evitar abuso.
        recordUsage(admin, userId, ACTION_TYPES.NOVA_MESSAGE).catch(() => {})
        return res.status(502).json({
          error: 'llm_bad_output',
          reply: 'Tuve un problema procesando la respuesta. Repite el mensaje por favor.',
          actions: [],
        })
      }
    }

    // PASO 2b — Haiku parseó OK pero ¿la respuesta es de calidad suficiente?
    // Detectamos signals de "esto va a salir mal" (ediciones strippeadas,
    // truncation) y escalamos a Sonnet con prompt refinado.
    const haikuActions = Array.isArray(parsed?.actions) ? parsed.actions : []
    const preFilter = filterCalendarEditActions(haikuActions, message)
    const escalateNeeded = shouldEscalateToSonnet(d1, preFilter.stripped.length)

    if (escalateNeeded) {
      try {
        const dPremium = await escalateToSonnet()
        const rPremium = (dPremium.content?.[0]?.text ?? '').trim()
        const parsedPremium = safeParseAssistantJSON(rPremium)
        return finalize(parsedPremium, { escalated: true })
      } catch {
        // Sonnet también falló al parsear → caemos al Haiku original (que
        // al menos parseó OK). filterCalendarEditActions en finalize()
        // strippea las ediciones malas y agrega la nota humana al reply.
        console.warn('[focus-assistant] Sonnet escalation failed, falling back to Haiku response')
        return finalize(parsed, { escalated: false })
      }
    }

    return finalize(parsed, { escalated: false })
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

// ── Today Context ─────────────────────────────────────────────────────────
// Cerebro del Ambient Pulse y el Resumen ejecutivo. Devuelve un único JSON:
//   { ambient: 'low'|'medium'|'high',
//     summary: string,
//     weather: string|null,
//     flags: { urgentEvent, meetingsBackToBack, actionableInsight, freeHours } }
//
// Vive en focus-assistant.js (no como endpoint propio) porque Vercel Hobby
// limita a 12 serverless functions y ya estábamos en el tope.

const TODAY_CTX_WEATHER_CACHE = new Map()
const TODAY_CTX_WEATHER_TTL_MS = 30 * 60 * 1000

async function handleTodayContext(req, res, userId) {
  const { todayISO, tomorrowISO, location = null, clientNow = Date.now() } = req.body ?? {}
  if (!todayISO || typeof todayISO !== 'string') {
    return res.status(400).json({ error: 'missing_today_iso' })
  }

  const supa = getSupabaseAdmin()
  if (!supa) return res.status(503).json({ error: 'service_unavailable' })

  const { data: todayRows } = await supa
    .from('events')
    .select('id, title, time, date, section')
    .eq('user_id', userId)
    .eq('date', todayISO)
    .order('time', { ascending: true })
  const { data: tmwRows } = await supa
    .from('events')
    .select('id, title, time, date')
    .eq('user_id', userId)
    .eq('date', tomorrowISO)
    .limit(1)

  const todayEvents = (todayRows ?? []).filter((e) => e.time)
  const firstTomorrow = (tmwRows ?? [])[0] ?? null

  let weatherSummary = null
  let weatherTip = null
  if (location?.lat && location?.lon) {
    const cached = TODAY_CTX_WEATHER_CACHE.get(userId)
    let weather = cached && Date.now() - cached.at < TODAY_CTX_WEATHER_TTL_MS ? cached.data : null
    if (!weather) {
      try {
        weather = await fetchWeather(location.lat, location.lon)
        TODAY_CTX_WEATHER_CACHE.set(userId, { at: Date.now(), data: weather })
      } catch {
        // ignore
      }
    }
    if (weather?.current) {
      const code = weather.current.weather_code
      weatherSummary = `${describeWeatherCode(code)}, ${Math.round(weather.current.temperature_2m)}°C`
      weatherTip = humanizeTodayWeather(weather, todayEvents)
    }
  }

  const analysis = analyzeTodayDay(todayEvents, firstTomorrow, clientNow)

  let ambient = 'low'
  const flags = {
    urgentEvent: analysis.urgentEvent,
    meetingsBackToBack: analysis.backToBack,
    actionableInsight: !!weatherTip,
    freeHours: analysis.qualityHoursLeft,
  }
  if (analysis.urgentEvent) ambient = 'high'
  else if (analysis.backToBack || weatherTip) ambient = 'medium'

  const summary = buildTodaySummary({
    todayEvents, analysis, hour: new Date(clientNow).getHours(),
  })

  return res.json({
    ambient,
    summary,
    weather: weatherTip ?? weatherSummary,
    flags,
  })
}

function todayCtxTimeToMin(t) {
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function analyzeTodayDay(events, firstTomorrow, nowMs) {
  const now = new Date(nowMs)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const dayEnd = 23 * 60

  const upcoming = events
    .map((e) => ({ ...e, mins: todayCtxTimeToMin(e.time) }))
    .filter((e) => e.mins != null && e.mins >= nowMin)
    .sort((a, b) => a.mins - b.mins)

  const nextEvent = upcoming[0] ?? null
  const minsUntilNext = nextEvent ? nextEvent.mins - nowMin : null
  const urgentEvent = minsUntilNext != null && minsUntilNext <= 15 && minsUntilNext > 0

  let backToBack = false
  if (upcoming.length >= 3) {
    let chain = 1
    for (let i = 1; i < upcoming.length; i++) {
      const gap = upcoming[i].mins - upcoming[i - 1].mins
      if (gap < 20) {
        chain++
        if (chain >= 3) { backToBack = true; break }
      } else {
        chain = 1
      }
    }
  }

  const ceil = nextEvent ? Math.min(nextEvent.mins, dayEnd) : dayEnd
  const rawMin = Math.max(0, ceil - nowMin)
  const qualityHoursLeft = Math.round(((rawMin / 60) - 0.5 * Math.floor(rawMin / 60)) * 2) / 2

  return { urgentEvent, backToBack, nextEvent, minsUntilNext, qualityHoursLeft, firstTomorrow }
}

function humanizeTodayWeather(weather, todayEvents) {
  const daily = weather?.daily
  if (!daily?.precipitation_probability_max) return null
  const todayProb = daily.precipitation_probability_max[0]
  const tomorrowProb = daily.precipitation_probability_max[1]

  if (todayProb >= 60 && todayEvents.length > 0) {
    const outdoor = todayEvents.find((e) =>
      /gym|salir|super|fútbol|paseo|caminar|cafe|cita/i.test(e.title || '')
    )
    if (outdoor) {
      return `Lluvia probable hoy (${todayProb}%); considera adelantar "${outdoor.title}".`
    }
    return `Lluvia probable hoy (${todayProb}%). Lleva paraguas.`
  }
  if (tomorrowProb >= 70) return `Mañana llueve fuerte (${tomorrowProb}%).`
  return null
}

function buildTodaySummary({ todayEvents, analysis, hour }) {
  if (analysis.urgentEvent) {
    return `${analysis.nextEvent.title} en ${analysis.minsUntilNext} min.`
  }
  if (analysis.backToBack) {
    return 'Calendario apretado: 3+ eventos seguidos. Mantén el ritmo.'
  }
  if (todayEvents.length === 0) {
    if (hour < 12) return `Día limpio — ${analysis.qualityHoursLeft}h de margen útil.`
    if (hour < 18) return `Tarde abierta — ${analysis.qualityHoursLeft}h útiles por delante.`
    return 'Casi cierre. Mañana lo planeamos juntos.'
  }
  if (analysis.qualityHoursLeft >= 2) {
    return `Tienes ${analysis.qualityHoursLeft}h libres antes de tu próximo bloque.`
  }
  return 'Día programado. Vamos paso a paso.'
}
