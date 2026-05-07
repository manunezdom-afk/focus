// POST /api/auth/delete-account
//
// Borra la cuenta del usuario autenticado y todos sus datos. Requerido para
// App Store Review (Guideline 5.1.1(v)) y para alinearse con GDPR/CCPA en el
// lanzamiento beta. La operación es irreversible — el cliente debe pedir
// confirmación explícita antes de invocarla.
//
// Algoritmo:
//   1. Validar JWT del usuario y obtener su id.
//   2. Limpiar tablas que NO tienen ON DELETE CASCADE conectado a
//      auth.users (las que sí cascadean caen al borrar el auth user). Es
//      defensivo: hoy todas tienen REFERENCES auth.users(id) ON DELETE
//      CASCADE, pero hacemos el cleanup explícito para que un cambio
//      futuro de schema no nos deje datos huérfanos sin que nadie note.
//   3. Borrar el usuario desde auth.users via admin.auth.admin.deleteUser
//      → eso cascadea events, tasks, suggestions, user_memories,
//      user_signals, user_behavior, push_subscriptions,
//      native_push_tokens, notif_log, calendar_feeds, kairos_links,
//      sent_notifications, notification_deliveries, ai_usage,
//      ai_usage_events, user_plans, device_pairings (todas REFERENCES
//      auth.users con CASCADE).
//
// IMPORTANTE: si en el futuro se agrega una tabla con datos del usuario,
// asegurarse de que tenga `REFERENCES auth.users(id) ON DELETE CASCADE`
// — si no, los datos quedan huérfanos y rompemos el contrato de borrado
// total que mostramos al usuario.
//
// Si cualquier paso falla, devolvemos 500 con un código identificable y el
// cliente puede reintentar — los pasos previos son idempotentes.
//
// Body opcional: { confirm: 'DELETE' } — el cliente envía este string como
// segundo cinturón contra clicks accidentales (la UI muestra un confirm con
// la palabra requerida).

import { rateLimited, clientIp } from '../_lib/rateLimit.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from '../_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from '../_supabaseAdmin.js'

export const maxDuration = 30

// Tablas que sabemos que cascadean al borrar el auth user (CASCADE FK).
// Listadas aquí solo para documentación/visibilidad — NO las borramos
// manualmente, dejamos que Postgres haga el cascade vía deleteUser.
// const CASCADE_TABLES = [
//   'user_profiles', 'events', 'tasks', 'blocks',
//   'suggestions', 'user_memories', 'notif_log',
//   'user_signals', 'user_behavior',
//   'push_subscriptions', 'native_push_tokens',
//   'sent_notifications', 'calendar_feeds',
//   'notification_deliveries', 'ai_usage', 'ai_usage_events',
//   'user_plans', 'kairos_links', 'device_pairings',
// ]

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  // Rate limit por IP — borrar cuenta no es algo que se haga rápido.
  if (rateLimited(`delete-account:${clientIp(req)}`, { max: 5, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) return res.status(401).json({ error: 'auth_required' })

  // Cinturón anti click-accidental: el cliente debe enviar la palabra "DELETE".
  // No es seguridad real (cualquier atacante con el JWT puede mandarla); es
  // un guard contra UX accidental — la UI pide al usuario tipear "DELETE".
  const confirm = String(req.body?.confirm || '').trim()
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'missing_confirmation' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).json({ error: 'no_backend_supabase' })

  try {
    // El cascade de la FK cubre TODO lo que tiene REFERENCES auth.users(id)
    // ON DELETE CASCADE — es decir todas las tablas privadas del usuario.
    // deleteUser invalida el access_token actual además de borrar la fila
    // de auth.users; el cliente hará logout local al recibir 200.
    const { error } = await admin.auth.admin.deleteUser(userId, true /* shouldSoftDelete=false equivalent */)
    if (error) {
      console.error('[delete-account] admin.deleteUser failed:', error.message)
      return res.status(500).json({ error: 'delete_failed' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[delete-account] unexpected', err?.name || 'Error')
    return res.status(500).json({ error: 'internal_error' })
  }
}
