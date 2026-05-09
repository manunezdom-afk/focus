// Forma "app" de los datos en mobile. Espejo simplificado de los converters
// `taskFromDb` / `eventFromDb` de src/services/dataService.js de la web — pero
// solo los campos que la Fase 2 mobile usa. Cuando agreguemos features
// (linkedEventId, parentTaskId, reminders, etc.) extender estos tipos antes
// de tocar las queries.

export type TaskPriority = 'Alta' | 'Media' | 'Baja';

export type Task = {
  id: string;
  label: string;
  done: boolean;
  priority: TaskPriority;
  category: string;
  doneAt: number | null;
  createdAt: string | null;
  // Campos agregados por las migraciones 016 + 017 (subtareas y fechas).
  // Si las migraciones no están aplicadas todavía en el server, vienen
  // como null y la UI degrada limpiamente — no se rompen las screens.
  parentTaskId: string | null;
  linkedEventId: string | null;
  // Formato 'YYYY-MM-DD' (zona local del usuario), igual que events.date.
  // null = tarea sin fecha (cae a `category` para clasificarla).
  dueDate: string | null;
  // Formato 'HH:MM' o 'HH:MM-HH:MM'. null = sin hora puntual.
  dueTime: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  // Hora en formato "HH:MM" o rango "HH:MM - HH:MM" (24h). '' si no tiene hora.
  // Mismo string que escribe la web — no convertir a Date acá para no perder
  // el formato cuando el evento es solo de fecha o all-day.
  time: string;
  description: string;
  // 'focus' | 'rest' | 'personal' | etc. La web usa estos como buckets de
  // sección visual; en mobile lo dejamos pasar tal cual hasta que diseñemos
  // chips o filtros propios.
  section: string;
  icon: string;
  // 'YYYY-MM-DD' o null si el evento es flotante (no debería pasar — ver
  // useEvents.js de la web que defaultea a hoy).
  date: string | null;
  featured: boolean;
  createdAt: string | null;
};

// Bandeja de Nova — sugerencias propuestas que el usuario aprueba/rechaza.
// Backend: tabla `suggestions` (schema.sql + migración 018_nova_inbox.sql).
// Endpoints: GET /api/nova/inbox · PATCH /api/nova/inbox/:id.
export type SuggestionKind =
  // Acciones directas (heredadas del modo propuesta de Nova chat)
  | 'add_event'
  | 'edit_event'
  | 'delete_event'
  | 'mark_task_done'
  | 'add_task'
  // Reglas determinísticas server-side (V1)
  | 'overdue_batch'
  | 'overload_warning'
  // Futuras (placeholders — el cliente debe degradar limpio si llegan)
  | 'focus_block_suggestion'
  | 'conflict_detected'
  | 'prep_time_missing'
  | 'ambiguous_task'
  | 'routine_proposal'
  | 'daily_brief'
  | 'weekly_review'
  | 'multi_step_plan'
  | 'day_close_review'
  | 'break_suggestion';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'snoozed' | 'expired';

export type SuggestionSource = 'nova' | 'kairos' | 'rule' | 'user';

export type Suggestion = {
  id: string;
  kind: SuggestionKind | string; // string para tolerar kinds nuevos del backend sin romper el cliente
  payload: Record<string, unknown>;
  preview_title: string;
  preview_body: string;
  preview_icon: string;
  reason: string | null;
  status: SuggestionStatus;
  batch_id: string | null;
  // Score 0..1. Mayor = más prioritaria. La UI ordena DESC.
  relevance_score: number;
  source: SuggestionSource | string;
  // ISO timestamps. Si están en el futuro, la card no debe aparecer (snooze
  // activo) o ya pasó (expired). El backend filtra por defecto, pero el
  // cliente también debe respetarlos para evitar parpadeos en cache stale.
  snoozed_until: string | null;
  expires_at: string | null;
  created_at: string;
  resolved_at: string | null;
};
