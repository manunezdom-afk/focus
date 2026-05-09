// GET /api/nova/inbox
//
// Lista las sugerencias pendientes del usuario para la Bandeja de Nova.
// Respeta:
//   - status = 'pending' (no devuelve resueltas ni snoozed activas)
//   - snoozed_until: si hay snooze vigente, la sugerencia NO aparece
//   - expires_at: caducas no aparecen (lazy expiry — no necesitamos cron
//     para marcarlas; el filtro hace el trabajo)
// Ordena por relevance_score DESC y created_at DESC.
//
// Auth: Bearer del usuario. RLS adicional en Supabase como red de
// seguridad — aunque acá usamos service_role, filtramos por user_id del JWT.
//
// No incrementa cuota: es lectura pura.

import { setCorsHeaders } from '../_lib/security.js'
import { rateLimited, clientIp } from '../_lib/rateLimit.js'
import { getSupabaseAdmin, getUserIdFromAuth } from '../_supabaseAdmin.js'

export const maxDuration = 10

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'GET, OPTIONS' })

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  // Rate limit por IP — 60/min es generoso pero evita scraping. La bandeja
  // se refresca al pull-to-refresh y al volver de background; nunca debería
  // pegarle al límite en uso normal.
  if (rateLimited(clientIp(req), { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limit' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'auth_required', message: 'Inicia sesión para ver tu bandeja.' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).json({ error: 'service_unavailable' })

  // Cap defensivo: 50 cards. La UI muestra top N por relevancia; si llegamos
  // a tener más sugerencias activas algo está mal (el generador debería
  // limitar por plan). Mejor truncar acá que mandar 1MB al cliente.
  const LIMIT = 50
  const nowIso = new Date().toISOString()

  const { data, error } = await admin
    .from('suggestions')
    .select(
      'id, kind, payload, preview_title, preview_body, preview_icon, reason, status, batch_id, relevance_score, source, snoozed_until, expires_at, created_at, resolved_at',
    )
    .eq('user_id', userId)
    .eq('status', 'pending')
    .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('relevance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    // Tabla aún sin migrar: degradamos a lista vacía, no rompemos cliente.
    if (/does not exist|column .* does not exist/i.test(error.message || '')) {
      return res.status(200).json({ suggestions: [], pendingCount: 0, soft: 'schema_pending' })
    }
    console.error('[nova/inbox] select failed:', error.message)
    return res.status(500).json({ error: 'select_failed' })
  }

  const suggestions = data || []
  return res.status(200).json({
    suggestions,
    pendingCount: suggestions.length,
  })
}
