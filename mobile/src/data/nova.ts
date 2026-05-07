// Cliente Nova hacia /api/focus-assistant.
//
// Mismo contrato que la web (src/components/NovaWidget.jsx):
// - POST /api/focus-assistant con { message, events, tasks, history, ... }
// - Recibe { message, ... } o errores tipados (quota_exceeded, rate_limit, ...)
//
// La sesión Supabase se inyecta como Bearer automáticamente vía apiFetch.
//
// Errores se convierten a mensajes humanos, mismo mapping que la web. Eso
// asegura que el usuario vea "Llegaste al límite diario" en vez de "Error 429".

import { apiFetch } from '@/src/lib/api';
import type { Task, EventItem } from '@/src/data/types';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status?: 'sending' | 'sent' | 'error';
  errorCode?: string;
};

export type NovaActionShape = {
  type: string;
  payload?: Record<string, unknown>;
};

export type NovaReply = {
  message: string;
  actions?: NovaActionShape[];
  raw?: unknown;
};

export type NovaError = Error & { code?: string };

// Mensajes humanos por código de error. Coincide con el mapping legacy.
const ERROR_HUMAN_MESSAGES: Record<string, string> = {
  rate_limit: 'Muchos mensajes seguidos. Espera unos segundos.',
  upstream_rate_limit: 'Muchos mensajes seguidos. Espera unos segundos.',
  upstream_overloaded: 'El servicio está sobrecargado. Reintenta en un momento.',
  invalid_api_key: 'Servicio no disponible en este momento.',
  no_api_key: 'Servicio no disponible en este momento.',
  message_too_long: 'Mensaje demasiado largo.',
  llm_bad_output: 'No pude procesarlo. Repite por favor.',
  auth_required: 'Inicia sesión para hablar con Nova.',
  quota_exceeded: 'Llegaste al límite diario de mensajes con Nova. Vuelve mañana.',
};

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function sendNovaMessage(opts: {
  message: string;
  events: EventItem[];
  tasks: Task[];
  history: ChatMessage[];
  novaPersonality?: string;
}): Promise<NovaReply> {
  const { message, events, tasks, history, novaPersonality = 'focus' } = opts;

  // Mantener solo los últimos 20 turnos (igual que web).
  const trimmedHistory = history.slice(-20).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await apiFetch('/api/focus-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      events,
      tasks,
      history: trimmedHistory,
      // Nova en mobile no tiene aún location/profile/memories/behavior. El
      // backend acepta todos opcionales — la respuesta será un poco menos
      // contextualizada pero funciona. Siguiente fase: implementar.
      clientNow: Date.now(),
      clientTimezone: getTimezone(),
      novaPersonality,
    }),
  });

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code: string = data?.error;
    const humanMsg =
      code === 'quota_exceeded' && data?.message
        ? data.message
        : ERROR_HUMAN_MESSAGES[code] ?? data?.message ?? `Error ${res.status}`;
    const err = new Error(humanMsg) as NovaError;
    err.code = code;
    throw err;
  }

  // Response shape: { message: string, actions?: [], ... }
  return {
    message: data?.message || data?.reply || '',
    actions: Array.isArray(data?.actions) ? data.actions : undefined,
    raw: data,
  };
}
