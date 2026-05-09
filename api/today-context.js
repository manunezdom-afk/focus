import { rateLimited, clientIp } from './_lib/rateLimit.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from './_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from './_supabaseAdmin.js'
import { buildWeatherContext, fetchWeather, describeWeatherCode } from './_lib/weather.js'

// /api/today-context — el cerebro del Ambient Pulse y el Resumen ejecutivo.
//
// Devuelve un único JSON con:
//   ambient: 'low' | 'medium' | 'high'   ← intensidad del pulso de Nova
//   summary: string                      ← una línea humana del estado del día
//   weather: string | null               ← tip operativo cruzando clima + agenda
//   flags: { urgentEvent, meetingsBackToBack, actionableInsight, freeHours }
//
// Lógica de ambient:
//   - Evento en <15min y la app no se abrió desde antes  → 'high'
//   - 3+ eventos seguidos sin gap >=20min                 → 'medium'
//   - Insight actionable (lluvia + tarea outdoor)         → 'medium'
//   - Resto                                                → 'low'
export const maxDuration = 15

// Cache simple en memoria del proceso para no quemar tokens de Open-Meteo.
// 30 min por usuario es suficiente — el clima no cambia tanto en ese rango.
const WEATHER_CACHE = new Map() // userId → { at, data }
const WEATHER_TTL_MS = 30 * 60 * 1000

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  if (rateLimited(clientIp(req), { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) return res.status(401).json({ error: 'unauthorized' })

  const { todayISO, tomorrowISO, location = null, clientNow = Date.now() } = req.body ?? {}
  if (!todayISO || typeof todayISO !== 'string') {
    return res.status(400).json({ error: 'missing_today_iso' })
  }

  const supa = getSupabaseAdmin()
  if (!supa) return res.status(503).json({ error: 'service_unavailable' })

  // 1) Eventos del día y de mañana — para gaps y urgencias
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

  // 2) Clima cacheado (cada 30min por usuario) si hay location
  let weatherSummary = null
  let weatherTip = null
  if (location?.lat && location?.lon) {
    const cached = WEATHER_CACHE.get(userId)
    let weather = cached && Date.now() - cached.at < WEATHER_TTL_MS ? cached.data : null
    if (!weather) {
      try {
        weather = await fetchWeather(location.lat, location.lon)
        WEATHER_CACHE.set(userId, { at: Date.now(), data: weather })
      } catch {
        // ignore — seguimos sin clima
      }
    }
    if (weather?.current) {
      const code = weather.current.weather_code
      weatherSummary = `${describeWeatherCode(code)}, ${Math.round(weather.current.temperature_2m)}°C`
      weatherTip = humanizeWeather(weather, todayEvents, clientNow)
    }
  }

  // 3) Análisis de gaps + colisiones
  const analysis = analyzeDay(todayEvents, firstTomorrow, clientNow)

  // 4) Decidir ambient level
  let ambient = 'low'
  const flags = {
    urgentEvent: analysis.urgentEvent,
    meetingsBackToBack: analysis.backToBack,
    actionableInsight: !!weatherTip,
    freeHours: analysis.qualityHoursLeft,
  }
  if (analysis.urgentEvent) ambient = 'high'
  else if (analysis.backToBack || weatherTip) ambient = 'medium'

  // 5) Summary humano según contexto
  const summary = buildSummary({ todayEvents, analysis, hour: new Date(clientNow).getHours() })

  return res.json({
    ambient,
    summary,
    weather: weatherTip ?? weatherSummary,
    flags,
  })
}

// "HH:MM" → minutos desde medianoche
function timeToMin(t) {
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// Restamos 20min de buffer entre reuniones — tiempo "real" para enfocarse.
function analyzeDay(events, firstTomorrow, nowMs) {
  const now = new Date(nowMs)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const dayEnd = 23 * 60 // 23:00 corte útil

  // Próximo evento desde ahora
  const upcoming = events
    .map((e) => ({ ...e, mins: timeToMin(e.time) }))
    .filter((e) => e.mins != null && e.mins >= nowMin)
    .sort((a, b) => a.mins - b.mins)

  const nextEvent = upcoming[0] ?? null
  const minsUntilNext = nextEvent ? nextEvent.mins - nowMin : null
  const urgentEvent = minsUntilNext != null && minsUntilNext <= 15 && minsUntilNext > 0

  // Back-to-back: 3+ eventos donde gaps entre consecutivos < 20min
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

  // Horas de calidad: hasta el próximo evento o fin del día. Restamos 30min/h
  // como buffer (Deep Work, no tiempo bruto).
  const ceil = nextEvent ? Math.min(nextEvent.mins, dayEnd) : dayEnd
  const rawMin = Math.max(0, ceil - nowMin)
  const qualityHoursLeft = Math.round(((rawMin / 60) - 0.5 * Math.floor(rawMin / 60)) * 2) / 2

  return { urgentEvent, backToBack, nextEvent, minsUntilNext, qualityHoursLeft, firstTomorrow }
}

function humanizeWeather(weather, todayEvents, nowMs) {
  // Buscar primera hora con lluvia probable >50% en el daily
  const daily = weather?.daily
  if (!daily?.precipitation_probability_max) return null
  const todayProb = daily.precipitation_probability_max[0]
  const tomorrowProb = daily.precipitation_probability_max[1]

  // Heurística simple: si hoy >60% lluvia y hay evento outdoor (gym, salir,
  // supermercado, fútbol) sugerimos adelantar. Si no, devolvemos null para
  // no spamear al usuario con datos vacíos.
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

function buildSummary({ todayEvents, analysis, hour }) {
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
