import { rateLimited, clientIp } from './_lib/rateLimit.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from './_lib/security.js'
import { getUserIdFromAuth } from './_supabaseAdmin.js'

// Endpoint de transcripción con OpenAI Whisper — mismo modelo que ChatGPT Voice.
// Recibe audio en base64 (m4a/mp4/webm), lo envía a Whisper y devuelve el texto.
// Requiere OPENAI_API_KEY en las variables de entorno de Vercel.
export const maxDuration = 30

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'

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

  try {
    const audioBuffer = Buffer.from(audio, 'base64')
    const blob = new Blob([audioBuffer], { type: mimeType })
    const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
      : mimeType.includes('webm') ? 'webm'
      : mimeType.includes('wav') ? 'wav'
      : 'm4a'
    const file = new File([blob], `audio.${ext}`, { type: mimeType })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')
    formData.append('response_format', 'text')

    const openaiRes = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '')
      console.error('[transcribe] OpenAI error:', openaiRes.status, errText)
      return res.status(502).json({ error: 'transcription_failed' })
    }

    const text = await openaiRes.text()
    return res.json({ text: text.trim() })
  } catch (err) {
    console.error('[transcribe] error:', err?.message)
    return res.status(500).json({ error: 'internal_error' })
  }
}
