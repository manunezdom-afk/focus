import { rateLimited, clientIp } from './_lib/rateLimit.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from './_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from './_supabaseAdmin.js'
import { ACTION_TYPES, checkLimit, getUserPlan, recordUsage } from './_lib/usageLimits.js'
import { trackAIUsageEvent } from './_lib/aiUsageTracking.js'

// Endpoint de transcripción con OpenAI Whisper (mismo modelo que ChatGPT Voice).
// Recibe audio en base64 (m4a/mp4/webm), lo manda a Whisper y devuelve el texto.
// Requiere OPENAI_API_KEY en las variables de entorno de Vercel.
//
// Flujo:
//   1. Auth → userId del JWT Supabase.
//   2. checkLimit(VOICE_AI) → 429 si superó cuota del plan.
//   3. Validación: tamaño máximo y mimeType.
//   4. Whisper con response_format=verbose_json para conocer duration.
//   5. recordUsage(VOICE_AI) solo si la transcripción salió bien.
//   6. trackAIUsageEvent con cost_override calculado por segundos × precio.
//
// Privacidad: NO se loggea el texto transcrito, ni se guarda el audio. La
// metadata sólo incluye duración en segundos y plan — nada que identifique
// al usuario o revele el contenido.
export const maxDuration = 30

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-1'
// Whisper-1: USD 0.006 por minuto. Lo dividimos para tener costo por segundo.
const WHISPER_USD_PER_SECOND = 0.006 / 60

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  if (rateLimited(clientIp(req), { max: 30, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) return res.status(401).json({ error: 'unauthorized' })

  const admin = getSupabaseAdmin()
  const plan = await getUserPlan(admin, userId)
  const quota = await checkLimit(admin, userId, plan, ACTION_TYPES.VOICE_AI)
  if (!quota.ok) {
    return res.status(429).json({
      error: 'quota_exceeded',
      message: quota.message,
      plan: quota.plan,
      resetAt: quota.resetAt,
    })
  }

  const { audio, mimeType = 'audio/m4a' } = req.body ?? {}
  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({ error: 'missing_audio' })
  }
  // Límite: ~5MB base64 ≈ ~3.75MB de audio ≈ ~30s a 1Mbps
  if (audio.length > 7_000_000) {
    return res.status(413).json({ error: 'audio_too_large' })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error('[transcribe] OPENAI_API_KEY no configurada')
    return res.status(503).json({ error: 'service_unavailable' })
  }

  const startedAt = Date.now()
  let audioSeconds = 0
  let success = false
  let errorType = null

  try {
    const audioBuffer = Buffer.from(audio, 'base64')
    if (audioBuffer.length === 0) {
      errorType = 'empty_audio'
      return res.status(400).json({ error: 'empty_audio' })
    }

    const blob = new Blob([audioBuffer], { type: mimeType })
    const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
      : mimeType.includes('webm') ? 'webm'
      : mimeType.includes('wav') ? 'wav'
      : 'm4a'
    const file = new File([blob], `audio.${ext}`, { type: mimeType })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', WHISPER_MODEL)
    formData.append('language', 'es')
    // verbose_json devuelve `duration` (en segundos) → necesario para
    // calcular costo real. Antes usábamos response_format=text y siempre
    // metíamos costo 0 al tracker.
    formData.append('response_format', 'verbose_json')

    const openaiRes = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!openaiRes.ok) {
      errorType = `openai_${openaiRes.status}`
      // No volcamos el body de OpenAI al cliente — puede contener detalles
      // útiles para un atacante (rate-limit headers, modelo interno, etc.).
      try {
        const safeBody = await openaiRes.text()
        console.error('[transcribe] OpenAI error:', openaiRes.status, safeBody?.slice?.(0, 120))
      } catch {}
      return res.status(502).json({ error: 'transcription_failed' })
    }

    const data = await openaiRes.json()
    const text = typeof data?.text === 'string' ? data.text.trim() : ''
    audioSeconds = Math.max(0, Number(data?.duration) || 0)

    if (!text) {
      errorType = 'empty_transcript'
      return res.status(422).json({ error: 'empty_transcript' })
    }

    success = true
    return res.json({ text })
  } catch (err) {
    errorType = err?.name || 'internal_error'
    // Solo loggear el name + un fragmento corto. Evitar volcar el err
    // completo (puede tener stack con paths o keys).
    console.error('[transcribe] error:', err?.name || 'Error', String(err?.message || '').slice(0, 80))
    return res.status(500).json({ error: 'internal_error' })
  } finally {
    const duration_ms = Date.now() - startedAt
    if (success) {
      // Solo registramos la cuota cuando la transcripción salió bien — un
      // timeout o un audio corrupto no debe gastar el límite del usuario.
      void recordUsage(admin, userId, ACTION_TYPES.VOICE_AI)
    }
    void trackAIUsageEvent({
      admin,
      userId,
      action_type: ACTION_TYPES.VOICE_AI,
      endpoint: '/api/transcribe',
      model: WHISPER_MODEL,
      usage: { input_tokens: 0, output_tokens: 0, source: 'estimated' },
      cost_override_usd: success ? Number((audioSeconds * WHISPER_USD_PER_SECOND).toFixed(6)) : 0,
      success,
      error_type: errorType,
      duration_ms,
      metadata: {
        plan: quota.plan,
        audio_seconds: Math.round(audioSeconds * 100) / 100,
      },
    })
  }
}
