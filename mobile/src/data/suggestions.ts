// Cliente de la Bandeja de Nova hacia /api/nova/*.
//
// Endpoints:
//   GET   /api/nova/inbox              → listar pending del usuario
//   PATCH /api/nova/inbox/:id          → approve / reject / snooze / edit
//   POST  /api/nova/generate-suggestions { self: true } → forzar generación
//
// Patrón espejo de mobile/src/data/nova.ts: apiFetch inyecta Bearer
// automático, errores se mapean a mensajes humanos, mismo manejo de
// quota_exceeded y rate_limit.

import { apiFetch } from '@/src/lib/api';
import type { Suggestion } from '@/src/data/types';

export type SuggestionsError = Error & { code?: string; resetAt?: string | null };

// Error humano por código. Coincide con el resto de la app.
const ERROR_HUMAN_MESSAGES: Record<string, string> = {
  rate_limit: 'Muchos cambios seguidos. Espera unos segundos.',
  auth_required: 'Inicia sesión para ver tu bandeja.',
  quota_exceeded: 'Llegaste al límite diario de acciones inteligentes. Vuelve mañana.',
  not_found: 'Esta sugerencia ya no existe.',
  already_resolved: 'Esta sugerencia ya fue resuelta.',
  invalid_action: 'Acción no válida.',
  invalid_payload: 'Los datos no son válidos.',
  payload_too_large: 'La edición es demasiado larga.',
  apply_failed: 'No se pudo aplicar la sugerencia. Reintenta.',
  service_unavailable: 'Servicio no disponible en este momento.',
};

function humanError(data: any, fallback: string): SuggestionsError {
  const code: string | undefined = data?.error;
  const msg =
    (code === 'quota_exceeded' && typeof data?.message === 'string' && data.message) ||
    (code && ERROR_HUMAN_MESSAGES[code]) ||
    (typeof data?.message === 'string' && data.message) ||
    fallback;
  const err = new Error(msg) as SuggestionsError;
  err.code = code;
  if (data?.reset_at) err.resetAt = String(data.reset_at);
  return err;
}

export async function fetchSuggestions(): Promise<{ suggestions: Suggestion[]; pendingCount: number }> {
  const res = await apiFetch('/api/nova/inbox', { method: 'GET' });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw humanError(data, `Error ${res.status}`);
  return {
    suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
    pendingCount: Number.isFinite(data?.pendingCount) ? Number(data.pendingCount) : 0,
  };
}

export type ApproveResult = {
  ok: true;
  id: string;
  status: string;
  applied: { type: string; [key: string]: unknown } | null;
};

export async function approveSuggestion(id: string): Promise<ApproveResult> {
  const res = await apiFetch(`/api/nova/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw humanError(data, `Error ${res.status}`);
  return data as ApproveResult;
}

export async function rejectSuggestion(
  id: string,
  opts: { dismissKind?: boolean; reason?: string } = {},
): Promise<{ ok: true; id: string; status: string }> {
  const res = await apiFetch(`/api/nova/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reject',
      dismiss_kind: !!opts.dismissKind,
      reason: opts.reason || undefined,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw humanError(data, `Error ${res.status}`);
  return data;
}

// Atajos humanos aceptados por el backend: '1h' | '3h' | 'tomorrow' |
// 'next_week' o un ISO timestamp. Mantenerlos sincronizados con
// api/nova/inbox/[id].js → parseSnoozeUntil().
export type SnoozePreset = '1h' | '3h' | 'tomorrow' | 'next_week';

export async function snoozeSuggestion(
  id: string,
  snoozeUntil: SnoozePreset | string,
): Promise<{ ok: true; id: string; status: string }> {
  const res = await apiFetch(`/api/nova/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'snooze', snooze_until: snoozeUntil }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw humanError(data, `Error ${res.status}`);
  return data;
}

export async function editSuggestion(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; id: string; status: string }> {
  const res = await apiFetch(`/api/nova/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'edit', payload }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw humanError(data, `Error ${res.status}`);
  return data;
}

// Pull-to-refresh manual: pide al backend que evalúe si hay nuevas reglas
// que generen sugerencias para el usuario actual. Best-effort: si falla,
// la lista existente sigue válida.
export async function triggerSelfGeneration(): Promise<{ ok: boolean; created: number; skipped: number }> {
  try {
    const res = await apiFetch('/api/nova/generate-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ self: true }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, created: 0, skipped: 0 };
    return {
      ok: !!data?.ok,
      created: Number(data?.created || 0),
      skipped: Number(data?.skipped || 0),
    };
  } catch {
    return { ok: false, created: 0, skipped: 0 };
  }
}
