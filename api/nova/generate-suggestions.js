// POST /api/nova/generate-suggestions
//
// Generador de sugerencias proactivas para la Bandeja de Nova. Corre por
// reglas determinísticas sin tocar Anthropic — cero costo de tokens.
//
// Reglas V1:
//   1) overdue_batch    — usuario tiene 2+ tareas vencidas (due_date < hoy y
//                         no done). Una sola card propone re-agendar todas a
//                         hoy. relevance=0.85.
//   2) overload_warning — el día actual tiene 6+ items (events + tasks
//                         pendientes). relevance=0.65. Caduca al final del día.
//
// Anti-spam:
//   - 1 sugerencia activa por kind por usuario al mismo tiempo (si ya hay
//     una pending del mismo kind, NO creamos otra).
//   - Si el usuario rechazó el mismo kind ≥3 veces en últimos 14 días, NO
//     proponemos hasta que pase la cuarentena. Lectura barata sobre
//     nova_signals usando índice (user_id, kind).
//
// Auth (dos modos):
//   - Cron: header 'Authorization: Bearer ${CRON_SECRET}'. Sin user_id en
//     body → procesa todos los usuarios candidatos.
//   - Manual / debug: header 'Authorization: Bearer ${USER_JWT}' + body
//     {self: true} → procesa solo el usuario autenticado. Útil para que el
//     mobile pueda forzar un refresh al pull-to-refresh.
//
// Respuesta:
//   { ok: true, processed: N, created: M, skipped: K }

import { setCorsHeaders, rejectCrossSiteUnsafe } from '../_lib/security.js'
import { rateLimited, clientIp } from '../_lib/rateLimit.js'
import { getSupabaseAdmin, getUserIdFromAuth } from '../_supabaseAdmin.js'

export const maxDuration = 60

// Caps defensivos para que un cron no se vuelva una operación pesada.
const MAX_USERS_PER_RUN = 500
const REJECTION_THRESHOLD = 3       // rechazos para entrar en cuarentena
const REJECTION_WINDOW_DAYS = 14

function todayLocalISO() {
  // YYYY-MM-DD en UTC. Coincide con cómo se guarda due_date en tasks.
  return new Date().toISOString().slice(0, 10)
}

function endOfTodayUTC() {
  const t = new Date()
  t.setUTCHours(23, 59, 59, 999)
  return t.toISOString()
}

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  // Rate limit: este endpoint NO debería llamarse desde cliente normal en
  // ráfaga. Aceptamos hasta 6/min por IP — cubre cron + un par de pull-
  // to-refresh manuales sin inflar costos.
  if (rateLimited(clientIp(req), { max: 6, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limit' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).json({ error: 'service_unavailable' })

  // Decidir modo: cron (CRON_SECRET) o self-refresh (JWT del usuario).
  const auth = String(req.headers?.authorization || '').trim()
  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`
  const body = req.body || {}

  let targetUserIds = []

  if (isCron) {
    // Modo cron: traemos usuarios candidatos. Para no pegarle a auth.users
    // entera (mucha gente nunca volvió), filtramos por usuarios que tienen
    // al menos 1 tarea o evento — basta para excluir cuentas fantasma.
    // Una mejora futura: restringir por last_sign_in_at < 30 días.
    const { data: taskUsers } = await admin
      .from('tasks')
      .select('user_id')
      .limit(MAX_USERS_PER_RUN * 5) // hay duplicados, deduplicamos abajo
    const ids = new Set((taskUsers || []).map(r => r.user_id).filter(Boolean))

    const { data: eventUsers } = await admin
      .from('events')
      .select('user_id')
      .limit(MAX_USERS_PER_RUN * 5)
    for (const r of eventUsers || []) if (r.user_id) ids.add(r.user_id)

    targetUserIds = [...ids].slice(0, MAX_USERS_PER_RUN)
  } else {
    // Modo self-refresh: requiere JWT y body.self === true.
    if (!body.self) {
      return res.status(401).json({ error: 'auth_required' })
    }
    const userId = await getUserIdFromAuth(req)
    if (!userId) return res.status(401).json({ error: 'auth_required' })
    targetUserIds = [userId]
  }

  let created = 0
  let skipped = 0
  let processed = 0

  for (const userId of targetUserIds) {
    processed++
    try {
      const overdue = await maybeCreateOverdueBatch(admin, userId)
      if (overdue === 'created') created++
      else if (overdue === 'skipped') skipped++

      const overload = await maybeCreateOverloadWarning(admin, userId)
      if (overload === 'created') created++
      else if (overload === 'skipped') skipped++
    } catch (err) {
      // Un usuario problemático no debe romper el batch. Loggeamos y seguimos.
      console.warn('[nova/generate-suggestions] user fail:', userId, err?.message)
    }
  }

  return res.status(200).json({ ok: true, processed, created, skipped })
}

// ── Reglas ─────────────────────────────────────────────────────────────────

// Devuelve 'created' | 'skipped' | 'noop'.
async function maybeCreateOverdueBatch(admin, userId) {
  const today = todayLocalISO()

  // ¿Ya hay una pending del mismo kind para este usuario?
  const { data: existing } = await admin
    .from('suggestions')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'overdue_batch')
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length > 0) return 'skipped'

  // Cuarentena por rechazos repetidos.
  if (await isKindInQuarantine(admin, userId, 'overdue_batch')) return 'skipped'

  // Tareas vencidas: due_date estrictamente menor a hoy y no done.
  const { data: overdueTasks } = await admin
    .from('tasks')
    .select('id, label, due_date, priority')
    .eq('user_id', userId)
    .eq('done', false)
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(20)

  if (!overdueTasks || overdueTasks.length < 2) return 'noop'

  const taskIds = overdueTasks.map(t => t.id)
  const oldestDate = overdueTasks[0].due_date

  const id = `rule-overdue-${userId.slice(0, 8)}-${Date.now()}`
  const previewBody = `Vencidas desde ${oldestDate}. Tocar para re-agendar a hoy.`

  const { error } = await admin.from('suggestions').insert({
    id,
    user_id:        userId,
    kind:           'overdue_batch',
    payload:        { task_ids: taskIds, count: overdueTasks.length },
    preview_title:  `Tienes ${overdueTasks.length} tareas vencidas`,
    preview_body:   previewBody,
    preview_icon:   'exclamationmark.circle',
    reason:         'Hay tareas con fecha vencida sin completar; mover todas a hoy es una decisión rápida.',
    status:         'pending',
    relevance_score: 0.85,
    source:         'rule',
    expires_at:     null,
  })
  if (error) {
    console.warn('[nova/generate-suggestions] overdue insert:', error.message)
    return 'skipped'
  }
  return 'created'
}

async function maybeCreateOverloadWarning(admin, userId) {
  const today = todayLocalISO()

  const { data: existing } = await admin
    .from('suggestions')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'overload_warning')
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length > 0) return 'skipped'

  if (await isKindInQuarantine(admin, userId, 'overload_warning')) return 'skipped'

  // Eventos del día.
  const { data: todayEvents } = await admin
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)

  // Tareas que aparecen en Mi Día: category 'hoy' o due_date hoy, no done.
  const { data: todayTasks } = await admin
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('done', false)
    .or(`category.eq.hoy,due_date.eq.${today}`)

  const total = (todayEvents?.length || 0) + (todayTasks?.length || 0)
  if (total < 6) return 'noop'

  const id = `rule-overload-${userId.slice(0, 8)}-${Date.now()}`
  const { error } = await admin.from('suggestions').insert({
    id,
    user_id:        userId,
    kind:           'overload_warning',
    payload:        { date: today, total, events: todayEvents?.length || 0, tasks: todayTasks?.length || 0 },
    preview_title:  `Tu día tiene ${total} compromisos`,
    preview_body:   'Buen momento para mover algo a mañana.',
    preview_icon:   'tray.full',
    reason:         'Día con carga alta — sobrecargarse cuesta foco. Aprobar marca esta como vista.',
    status:         'pending',
    relevance_score: 0.65,
    source:         'rule',
    expires_at:     endOfTodayUTC(),
  })
  if (error) {
    console.warn('[nova/generate-suggestions] overload insert:', error.message)
    return 'skipped'
  }
  return 'created'
}

// Lee nova_signals y devuelve true si el usuario rechazó este kind con
// frecuencia recientemente. Mantiene la propuesta off-air por la ventana.
async function isKindInQuarantine(admin, userId, kind) {
  const sinceIso = new Date(Date.now() - REJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('nova_signals')
    .select('id, signal_type')
    .eq('user_id', userId)
    .eq('kind', kind)
    .in('signal_type', ['suggestion_rejected', 'suggestion_dismissed_kind'])
    .gte('created_at', sinceIso)
    .limit(REJECTION_THRESHOLD)
  return (data?.length || 0) >= REJECTION_THRESHOLD
}
