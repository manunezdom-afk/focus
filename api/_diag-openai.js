// /api/_diag-openai.js — ENDPOINT DIAGNÓSTICO TEMPORAL.
//
// **DEBE BORRARSE ANTES DE MERGE A MAIN.** Mientras viva en `claude/recursing-
// tu-3a5540` se usa para QA del provider OpenAI sin tocar Supabase, sin auth
// de usuario, sin cuotas de plan, sin crear eventos reales.
//
// Defensas duras:
//   1. Si VERCEL_ENV === 'production' → 403 (NUNCA disponible en Production).
//   2. Header `X-Diag-Secret` debe coincidir con env `NOVA_DIAG_SECRET`. La
//      env existe SOLO en Preview (configurada manualmente en Vercel UI).
//   3. NO importa `getSupabaseAdmin`, NO escribe filas, NO toca service_role.
//   4. Solo expone el resultado del flow OpenAI: prompt → modelo → adapter.
//
// Uso:
//   POST /api/_diag-openai
//   Headers:
//     Content-Type: application/json
//     X-Diag-Secret: <UUID generado para esta sesión QA>
//   Body:
//     { "messages": ["...", "..."], "tz": "America/Santiago", "clientNow": 1234567890 }
//
// Respuesta:
//   {
//     "provider": "openai",
//     "model": "<modelo activo>",
//     "tz": "...", "todayISO": "...", "tomorrow": "...",
//     "results": [
//       {
//         "input": "...",
//         "status": "ok"|"error",
//         "reqId": "diag-...",
//         "raw": { actions, needsClarification, ... }, // shape OpenAI Structured Output
//         "mapped": { reply, actions, mode, confidence, _dropped, ... }, // adapter → BackendAction
//         "tokens": { "input": N, "output": N },
//         "modelUsed": "..."
//       }
//     ]
//   }

import {
  buildOpenAISystemPrompt,
  callOpenAINova,
  extractResponsesText,
  convertOpenAIToBackendResponse,
} from './_lib/openaiNova.js'
import { buildDateContext } from './_lib/dateContext.js'

export const maxDuration = 60

export default async function handler(req, res) {
  // 1) Hard block en Production. VERCEL_ENV es inyectado por Vercel
  //    automáticamente; en local dev queda undefined (permitido).
  if (process.env.VERCEL_ENV === 'production') {
    return res.status(403).json({ error: 'diag_endpoint_disabled_in_production' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  // 2) Secret check con comparación constante (defensa contra timing
  //    attacks aunque acá no es crítico — el endpoint es efímero).
  const expected = process.env.NOVA_DIAG_SECRET?.trim() || ''
  const received = (typeof req.headers['x-diag-secret'] === 'string'
    ? req.headers['x-diag-secret']
    : '').trim()
  if (!expected || !received || expected.length !== received.length || expected !== received) {
    return res.status(401).json({ error: 'invalid_or_missing_secret' })
  }

  // 3) Config OpenAI.
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return res.status(503).json({ error: 'no_openai_key' })
  }
  const model = process.env.OPENAI_NOVA_MODEL || 'gpt-5.5'

  // 4) Inputs.
  const body = req.body || {}
  const messages = Array.isArray(body.messages)
    ? body.messages
    : (typeof body.message === 'string' ? [body.message] : [])
  if (messages.length === 0) {
    return res.status(400).json({ error: 'no_messages' })
  }
  if (messages.length > 25) {
    return res.status(400).json({ error: 'too_many_messages' })
  }

  // 5) Date context para que el prompt resuelva "hoy"/"mañana" en zona del
  //    usuario. Default America/Santiago.
  const tz = typeof body.tz === 'string' && body.tz ? body.tz : 'America/Santiago'
  const clientNow = typeof body.clientNow === 'number' ? body.clientNow : Date.now()
  const dateContext = buildDateContext(clientNow, tz)

  const systemPrompt = buildOpenAISystemPrompt({
    tz: dateContext.tz,
    todayISO: dateContext.todayISO,
    tomorrow: dateContext.tomorrow,
    currentTime24: dateContext.currentTime24,
    weekDates: dateContext.weekDates,
  })

  // 6) Una llamada por input — serial para no abrir N paralelas a OpenAI.
  //    Cada error queda capturado individualmente: si una falla, las
  //    demás siguen.
  const results = []
  for (const message of messages) {
    if (typeof message !== 'string' || !message.trim()) {
      results.push({ input: String(message), status: 'error', error: 'empty_message' })
      continue
    }
    const reqId = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    try {
      const data = await callOpenAINova({
        message,
        systemPrompt,
        model,
        apiKey,
        reqId,
      })
      const text = extractResponsesText(data)
      let raw
      try {
        raw = JSON.parse(text)
      } catch (parseErr) {
        results.push({
          input: message,
          status: 'error',
          reqId,
          rawText: text.slice(0, 500),
          error: `JSON parse failed: ${parseErr?.message?.slice(0, 100)}`,
        })
        continue
      }
      const mapped = convertOpenAIToBackendResponse({
        openaiPayload: raw,
        userMessage: message,
        reqId,
      })
      results.push({
        input: message,
        status: 'ok',
        reqId,
        raw,
        mapped,
        tokens: {
          input: data?.usage?.input_tokens ?? data?.usage?.prompt_tokens ?? 0,
          output: data?.usage?.output_tokens ?? data?.usage?.completion_tokens ?? 0,
        },
        modelUsed: data?.model || model,
      })
    } catch (err) {
      results.push({
        input: message,
        status: 'error',
        reqId,
        // Truncamos message para no filtrar payloads de OpenAI con la key.
        error: `${err?.name || 'Error'}: ${(err?.message || '').slice(0, 300)}`,
      })
    }
  }

  return res.status(200).json({
    provider: 'openai',
    model,
    tz: dateContext.tz,
    todayISO: dateContext.todayISO,
    tomorrow: dateContext.tomorrow,
    results,
  })
}
