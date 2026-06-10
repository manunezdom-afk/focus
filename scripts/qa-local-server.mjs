#!/usr/bin/env node
// Server local de QA — monta el handler REAL de /api/focus-assistant.js
// (estilo Vercel serverless) sobre un http.Server plano, para que la app
// iOS en el simulador pruebe el backend CON los fixes locales antes de
// mergear a main. No es para producción.
//
// Uso:
//   set -a; source .env.local; set +a
//   NOVA_PROVIDER=anthropic node scripts/qa-local-server.mjs
//
// Luego apuntar FocusConfig.apiOrigin a http://127.0.0.1:3939 (solo QA,
// revertir antes de commitear el cliente).
//
// Necesita en env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import http from 'node:http'

import focusAssistant from '../api/focus-assistant.js'

const PORT = Number(process.env.QA_PORT || 3939)

// Shim mínimo de los helpers que Vercel agrega a req/res.
function vercelify(req, res, body) {
  try {
    req.body = body ? JSON.parse(body) : {}
  } catch {
    req.body = {}
  }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(obj))
    return res
  }
  // res.end ya existe; setHeader ya existe.
}

const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  vercelify(req, res, body)

  const url = req.url || ''
  const started = Date.now()
  try {
    if (url.startsWith('/api/focus-assistant')) {
      await focusAssistant(req, res)
    } else {
      res.status(404).json({ error: 'not_found', note: 'qa-local-server solo monta /api/focus-assistant' })
    }
  } catch (err) {
    console.error('[qa-server] handler crash:', err?.message)
    if (!res.headersSent) res.status(500).json({ error: 'qa_server_crash' })
  } finally {
    console.log(`[qa-server] ${req.method} ${url} → ${res.statusCode} (${Date.now() - started}ms)`)
  }
})

server.listen(PORT, () => {
  const provider = (process.env.NOVA_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'anthropic')).trim()
  console.log(`[qa-server] escuchando en http://127.0.0.1:${PORT}`)
  console.log(`[qa-server] provider efectivo: ${provider}`)
  console.log(`[qa-server] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'presente' : 'FALTA'}`)
  console.log(`[qa-server] SUPABASE_URL: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ? 'presente' : 'FALTA'}`)
  console.log(`[qa-server] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'presente' : 'FALTA'}`)
})
