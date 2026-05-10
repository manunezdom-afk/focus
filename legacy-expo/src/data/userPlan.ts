// Cliente HTTP del plan del usuario y operaciones de cuenta.
//
// /api/me/plan       → lectura del plan + snapshot de uso de IA.
// /api/auth/delete-account → borrado total con confirm: 'DELETE'.
//
// Ambos endpoints requieren Bearer token Supabase (apiFetch lo inyecta).

import { apiFetch } from '@/src/lib/api';

export type PlanId = 'free' | 'early_access' | 'plus' | 'pro' | 'admin';

export type UsagePeriod = {
  name: 'daily' | 'weekly' | 'monthly';
  limit: number;
  used: number;
  resetAt: string; // ISO
};

export type UsageActionInfo = {
  // Config completo del límite — puede tener varios buckets temporales.
  limit: { daily?: number; weekly?: number; monthly?: number };
  periods: UsagePeriod[];
};

export type UserPlanInfo = {
  plan: PlanId;
  planLabel: string;
  // Mapa de action_type → uso.
  // action_type ∈ {'nova_message', 'nova_smart_action', 'organize_day', 'weekly_planning', 'voice_ai', 'photo_analysis'}
  usage: Record<string, UsageActionInfo>;
  // Si el backend tiene BETA_UNLIMITED=true en env vars, este flag llega
  // como true y la UI lo muestra ("Beta · uso ilimitado") en lugar de
  // las barras de uso habituales.
  betaUnlimited?: boolean;
};

const FALLBACK_PLAN: UserPlanInfo = {
  plan: 'free',
  planLabel: 'Free',
  usage: {},
  betaUnlimited: false,
};

// Lee el plan del usuario actual. Si la red falla o el endpoint todavía no
// está deployado, devolvemos el fallback (free, sin uso) para que la UI no
// quede atascada. Un Ajustes con "Free" sin números es mejor que un crash.
export async function fetchUserPlan(): Promise<UserPlanInfo> {
  try {
    const res = await apiFetch('/api/me/plan', { method: 'GET' });
    if (!res.ok) return FALLBACK_PLAN;
    const data: any = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return FALLBACK_PLAN;
    return {
      plan: (data.plan as PlanId) ?? 'free',
      planLabel: typeof data.planLabel === 'string' ? data.planLabel : 'Free',
      usage: (data.usage && typeof data.usage === 'object') ? data.usage : {},
      betaUnlimited: data.betaUnlimited === true,
    };
  } catch {
    return FALLBACK_PLAN;
  }
}

// Llama al endpoint server que borra la cuenta. El usuario debe escribir
// "ELIMINAR" en la UI; mandamos el string canónico "DELETE" (lo que espera
// el endpoint según api/auth/delete-account.js).
//
// Devuelve null si OK, string con código de error si falló. La UI maneja
// el código y muestra mensaje humano.
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    const res = await apiFetch('/api/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (res.ok) return { ok: true };
    const data: any = await res.json().catch(() => null);
    const code: string = data?.error || `http_${res.status}`;
    return {
      ok: false,
      code,
      message: humanMessageForDeleteError(code),
    };
  } catch {
    return {
      ok: false,
      code: 'network_error',
      message: 'Sin conexión. Reintenta cuando vuelvas a tener red.',
    };
  }
}

function humanMessageForDeleteError(code: string): string {
  switch (code) {
    case 'auth_required':
      return 'La sesión expiró. Inicia sesión de nuevo y reintenta.';
    case 'missing_confirmation':
      return 'Falta la confirmación. Intenta de nuevo.';
    case 'rate_limited':
      return 'Demasiados intentos. Espera un minuto y reintenta.';
    case 'no_backend_supabase':
    case 'delete_failed':
    case 'internal_error':
      return 'No pudimos completar el borrado. Reintenta en unos minutos.';
    default:
      return 'No pudimos completar el borrado. Reintenta en unos minutos.';
  }
}
