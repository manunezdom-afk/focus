// PATCH /api/nova/inbox/:id
//
// Resuelve una sugerencia de la bandeja: aprobar, rechazar, posponer o
// editar el payload. Cuando se aprueba, aplicamos el payload al modelo
// real (events / tasks). Cada acción escribe una fila en `nova_signals`
// para que el system prompt de Nova pueda aprender de los patrones del
// usuario.
//
// Body:
//   { action: 'approve' | 'reject' | 'snooze' | 'edit',
//     payload?: object,           // solo en 'edit' — sobreescribe payload
//     snooze_until?: string,      // solo en 'snooze' — ISO timestamp futuro
//     dismiss_kind?: boolean }    // solo en 'reject' — Nova no propone este kind por 14 días
//
// Cuotas:
//   - 'approve' que aplica una smart action (add_event/add_task/etc)
//     consume NOVA_SMART_ACTION. Si no hay cuota, marcamos approved pero
//     NO aplicamos (preservamos la decisión del usuario; le explicamos
//     en la respuesta que se le acabó la cuota).
//   - El resto (reject, snooze, edit) no consume cuota — son meta-acciones.

import { setCorsHeaders, rejectCrossSiteUnsafe } from '../../_lib/security.js'
import { rateLimited, clientIp } from '../../_lib/rateLimit.js'
import { getSupabaseAdmin, getUserIdFromAuth } from '../../_supabaseAdmin.js'
import { ACTION_TYPES, checkLimit, getUserPlan, recordUsage } from '../../_lib/usageLimits.js'

export const maxDuration = 10

const VALID_ACTIONS = new Set(['approve', 'reject', 'snooze', 'edit'])

// Kinds que aplican una acción concreta cuando se aprueban. Cualquier kind
// fuera de este set es informativo — aprobarlo solo marca la card como
// resuelta sin tocar otras tablas (ej. overload_warning, daily_brief).
const APPLY_HANDLERS = {
  add_event:        applyAddEvent,
  add_task:         applyAddTask,
  mark_task_done:   applyMarkTaskDone,
  overdue_batch:    applyOverdueBatch,
}

// ── Apply helpers ──────────────────────────────────────────────────────────

async function applyAddEvent(admin, userId, payload) {
  // Acepta los mismos campos que Nova chat insert: title obligatorio, fecha
  // y hora opcionales (sin hora = bloque del día).
  const title = String(payload?.title || '').trim().slice(0, 200)
  if (!title) return { ok: false, reason: 'invalid_payload', message: 'Título vacío.' }
  const id = `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const row = {
    id,
    user_id:     userId,
    title,
    time:        payload.time || null,
    description: payload.description || '',
    section:     payload.section || 'focus',
    icon:        payload.icon || 'event',
    date:        payload.date || null,
    featured:    !!payload.featured,
  }
  const { error } = await admin.from('events').insert(row)
  if (error) {
    console.error('[nova/inbox/[id]] add_event failed:', error.message)
    return { ok: false, reason: 'insert_failed' }
  }
  return { ok: true, applied: { type: 'add_event', id } }
}

async function applyAddTask(admin, userId, payload) {
  const label = String(payload?.label || payload?.title || '').trim().slice(0, 200)
  if (!label) return { ok: false, reason: 'invalid_payload', message: 'Tarea sin texto.' }
  const id = `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const row = {
    id,
    user_id:  userId,
    label,
    done:     false,
    priority: payload.priority || 'Media',
    category: payload.category || 'hoy',
    due_date: payload.due_date || null,
    due_time: payload.due_time || null,
  }
  const { error } = await admin.from('tasks').insert(row)
  if (error) {
    console.error('[nova/inbox/[id]] add_task failed:', error.message)
    return { ok: false, reason: 'insert_failed' }
  }
  return { ok: true, applied: { type: 'add_task', id } }
}

async function applyMarkTaskDone(admin, userId, payload) {
  const taskId = String(payload?.id || '').trim()
  if (!taskId) return { ok: false, reason: 'invalid_payload' }
  const { error } = await admin
    .from('tasks')
    .update({ done: true, done_at: Date.now(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('user_id', userId)
  if (error) {
    console.error('[nova/inbox/[id]] mark_task_done failed:', error.message)
    return { ok: false, reason: 'update_failed' }
  }
  return { ok: true, applied: { type: 'mark_task_done', id: taskId } }
}

// "Re-agendar todas las tareas vencidas a hoy" — acción del kind overdue_batch.
// El payload trae `task_ids: string[]` con los ids que el generador detectó
// vencidos al momento de crear la sugerencia. Si entre la creación y la
// aprobación alguna se completó o borró, simplemente la saltamos.
async function applyOverdueBatch(admin, userId, payload) {
  const ids = Array.isArray(payload?.task_ids) ? payload.task_ids.slice(0, 50) : []
  if (ids.length === 0) return { ok: true, applied: { type: 'overdue_batch', moved: 0 } }
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  const { data, error } = await admin
    .from('tasks')
    .update({ due_date: today, updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', userId)
    .eq('done', false)
    .select('id')
  if (error) {
    console.error('[nova/inbox/[id]] overdue_batch failed:', error.message)
    return { ok: false, reason: 'update_failed' }
  }
  return { ok: true, applied: { type: 'overdue_batch', moved: (data || []).length } }
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'PATCH, OPTIONS' })

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  if (rateLimited(clientIp(req), { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limit' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) return res.status(401).json({ error: 'auth_required' })

  const id = String(req.query?.id || '').trim()
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const body = req.body || {}
  const action = String(body.action || '').trim()
  if (!VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'invalid_action' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).json({ error: 'service_unavailable' })

  // Trae la sugerencia actual: necesitamos el kind y payload para cualquier
  // acción que aplique algo, y para escribir el signal correcto.
  const { data: existing, error: selErr } = await admin
    .from('suggestions')
    .select('id, user_id, kind, payload, status, source')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (selErr) {
    console.error('[nova/inbox/[id]] select failed:', selErr.message)
    return res.status(500).json({ error: 'select_failed' })
  }
  if (!existing) return res.status(404).json({ error: 'not_found' })
  if (existing.status !== 'pending' && action !== 'reject') {
    // Permitimos rechazar una snoozed/expired si el usuario quiere
    // limpiarla, pero no aprobar/editar/snooze cosas ya resueltas.
    return res.status(409).json({ error: 'already_resolved', status: existing.status })
  }

  const kind = existing.kind
  let appliedResult = null
  let updateRow = null
  let signalType = null
  let signalContext = {}

  if (action === 'approve') {
    // Si el kind tiene un handler de aplicación, chequeamos cuota antes de
    // ejecutar. Sin handler = card informativa; aprobar solo marca resuelta.
    const handler = APPLY_HANDLERS[kind]
    if (handler) {
      const plan = await getUserPlan(admin, userId)
      const smartCheck = await checkLimit(admin, userId, plan, ACTION_TYPES.NOVA_SMART_ACTION)
      if (!smartCheck.ok) {
        // Sin cuota: NO marcamos approved (preservamos para que el usuario
        // pueda intentar mañana) y devolvemos 429 con el mensaje humano.
        return res.status(429).json({
          error: 'quota_exceeded',
          action_type: smartCheck.action_type,
          plan: smartCheck.plan,
          reset_at: smartCheck.resetAt,
          message: smartCheck.message,
        })
      }
      appliedResult = await handler(admin, userId, existing.payload || {})
      if (!appliedResult?.ok) {
        return res.status(400).json({
          error: 'apply_failed',
          reason: appliedResult?.reason || 'unknown',
          message: appliedResult?.message || 'No se pudo aplicar la sugerencia.',
        })
      }
      // Contamos la smart action solo si efectivamente aplicamos algo.
      recordUsage(admin, userId, ACTION_TYPES.NOVA_SMART_ACTION).catch(() => {})
    }
    updateRow = { status: 'approved', resolved_at: new Date().toISOString() }
    signalType = 'suggestion_approved'
    signalContext = { applied: appliedResult?.applied || null }
  } else if (action === 'reject') {
    updateRow = { status: 'rejected', resolved_at: new Date().toISOString() }
    signalType = body.dismiss_kind ? 'suggestion_dismissed_kind' : 'suggestion_rejected'
    if (body.reason && typeof body.reason === 'string') {
      signalContext.reason = body.reason.slice(0, 200)
    }
  } else if (action === 'snooze') {
    const snoozeUntil = parseSnoozeUntil(body.snooze_until)
    if (!snoozeUntil) return res.status(400).json({ error: 'invalid_snooze_until' })
    updateRow = { status: 'snoozed', snoozed_until: snoozeUntil }
    signalType = 'suggestion_snoozed'
    signalContext = { snooze_until: snoozeUntil }
  } else if (action === 'edit') {
    // Edit deja la card pending con el payload actualizado. El usuario
    // luego aprueba o rechaza la versión editada. Validación liviana:
    // payload debe ser objeto y no exceder ~8KB.
    const newPayload = body.payload
    if (!newPayload || typeof newPayload !== 'object' || Array.isArray(newPayload)) {
      return res.status(400).json({ error: 'invalid_payload' })
    }
    const serialized = JSON.stringify(newPayload)
    if (serialized.length > 8000) {
      return res.status(400).json({ error: 'payload_too_large' })
    }
    updateRow = { payload: newPayload }
    signalType = 'suggestion_edited'
    signalContext = { fields: Object.keys(newPayload).slice(0, 20) }
  }

  // Update suggestion fila.
  const { error: updErr } = await admin
    .from('suggestions')
    .update(updateRow)
    .eq('id', id)
    .eq('user_id', userId)

  if (updErr) {
    console.error('[nova/inbox/[id]] update failed:', updErr.message)
    return res.status(500).json({ error: 'update_failed' })
  }

  // Fire-and-forget: registrar signal para feedback loop. No bloqueamos la
  // respuesta — si falla el insert, el usuario ya tuvo su acción aplicada
  // y la próxima sugerencia generará nuevo signal.
  if (signalType) {
    admin
      .from('nova_signals')
      .insert({
        user_id:     userId,
        signal_type: signalType,
        kind,
        context:     signalContext,
      })
      .then(({ error }) => {
        if (error) console.warn('[nova/inbox/[id]] nova_signals insert:', error.message)
      })
      .catch(() => {})
  }

  return res.status(200).json({
    ok: true,
    id,
    status: updateRow.status || existing.status,
    applied: appliedResult?.applied || null,
  })
}

// Acepta ISO timestamp, "1h", "tomorrow", "next_week".
function parseSnoozeUntil(value) {
  if (!value) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Atajos humanos comunes.
  const now = new Date()
  if (trimmed === '1h') return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  if (trimmed === '3h') return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString()
  if (trimmed === 'tomorrow') {
    const t = new Date(now)
    t.setDate(t.getDate() + 1)
    t.setHours(9, 0, 0, 0)
    return t.toISOString()
  }
  if (trimmed === 'next_week') {
    const t = new Date(now)
    t.setDate(t.getDate() + 7)
    t.setHours(9, 0, 0, 0)
    return t.toISOString()
  }

  // ISO timestamp directo.
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getTime() <= now.getTime()) return null
  // Cap a 30 días — más allá no es snooze, es "olvidalo".
  const maxFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (parsed.getTime() > maxFuture.getTime()) return null
  return parsed.toISOString()
}
