// GET /api/me/plan
//
// Devuelve el plan actual del usuario autenticado y un snapshot de su uso
// de IA hoy/semana. Read-only — no modifica nada. Usado por Ajustes mobile
// para mostrar "Free / Early Access / Admin" + "X / Y mensajes con Nova".
//
// Por qué exponer esto:
//   - El usuario quiere ver cuántos mensajes le quedan antes del reset.
//   - Apple App Store revisa que el usuario pueda ver su plan y los
//     límites antes de cualquier flujo de pago futuro.
//   - Las cuotas ya se enforcen server-side en focus-assistant.js; esto
//     solo lee el estado para renderizarlo en UI.
//
// Auth obligatoria: sin Bearer válido devolvemos 401. RLS no aplica acá
// porque usamos admin client (service_role), pero filtramos por el
// user_id derivado del JWT — defensa en profundidad.
//
// Response shape:
//   {
//     plan: 'free' | 'early_access' | 'plus' | 'pro' | 'admin',
//     planLabel: string,                   // ej: "Free", "Early Access"
//     usage: {                              // snapshot de getUsageSnapshot
//       [actionType]: {
//         limit: { daily?, weekly?, monthly? },
//         periods: [{ name, days, limit, used, resetAt }],
//       }
//     }
//   }

import { rateLimited, clientIp } from '../_lib/rateLimit.js'
import { rejectCrossSiteUnsafe, setCorsHeaders } from '../_lib/security.js'
import { getSupabaseAdmin, getUserIdFromAuth } from '../_supabaseAdmin.js'
import { getUserPlan, getUsageSnapshot, isBetaUnlimited, PLANS } from '../_lib/usageLimits.js'

export const maxDuration = 10

const PLAN_LABELS = {
  [PLANS.FREE]:         'Free',
  [PLANS.EARLY_ACCESS]: 'Early Access',
  [PLANS.PLUS]:         'Plus',
  [PLANS.PRO]:          'Pro',
  [PLANS.ADMIN]:        'Admin',
}

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'GET, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  // Rate limit muy laxo: este endpoint solo lee. Si un cliente lo polea cada
  // segundo, no hace daño. 60 req/min por IP cubre cualquier UI razonable.
  if (rateLimited(`me-plan:${clientIp(req)}`, { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  const userId = await getUserIdFromAuth(req)
  if (!userId) return res.status(401).json({ error: 'auth_required' })

  const admin = getSupabaseAdmin()
  const beta = isBetaUnlimited()

  if (!admin) {
    // Backend mal configurado — devolvemos un default seguro (free, sin
    // usage) para que la UI siga renderizando algo coherente.
    return res.status(200).json({
      plan: PLANS.FREE,
      planLabel: PLAN_LABELS[PLANS.FREE],
      usage: {},
      betaUnlimited: beta,
    })
  }

  try {
    const plan = await getUserPlan(admin, userId)
    const snapshot = await getUsageSnapshot(admin, userId, plan)
    return res.status(200).json({
      plan,
      planLabel: PLAN_LABELS[plan] || PLAN_LABELS[PLANS.FREE],
      usage: snapshot?.actions ?? {},
      betaUnlimited: beta,
    })
  } catch (err) {
    console.error('[me/plan] unexpected', err?.name || 'Error')
    // Fallback igual que arriba: devolver un default sin tirar 500.
    return res.status(200).json({
      plan: PLANS.FREE,
      planLabel: PLAN_LABELS[PLANS.FREE],
      usage: {},
      betaUnlimited: beta,
    })
  }
}
