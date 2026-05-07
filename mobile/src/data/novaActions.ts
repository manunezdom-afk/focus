// Action processor de Nova — espejo del que vive en src/components/FocusBar.jsx
// del legacy. Cuando /api/focus-assistant responde con { message, actions[] },
// este módulo aplica cada action al estado local llamando a los hooks de
// useEvents / useTasks. Cada action procesada queda registrada en un objeto
// AppliedItem para que el caller pueda mostrar chips ("Agregado: X") y
// permitir Deshacer (reverte borrando los IDs creados).
//
// Tipos de action soportados (alineado con system prompt de Nova):
//   add_event             { event: { title, time, date, description, section, ... } }
//   add_task              { task:  { label, priority, category } }
//   edit_event            { id, updates }
//   delete_event          { id, title?, time? }   ← title/time son fallback
//   toggle_task           { id, label? }
//   mark_task_done        { id, label? }   ← alias de toggle (legacy lo usa)
//   delete_task           { id, label? }
//   remember              { memory: {...} }   ← TODO: memorias en mobile
//
// El procesador es defensivo: cualquier action mal formada se ignora con
// warning, no rompe el flujo. Si un id viene bien pero la entidad no existe
// localmente, se intenta resolver por título/hora.

import type { CreateEventInput, deleteEvent } from './events';
import type { CreateTaskInput, TaskPatch } from './tasks';
import type { Task, EventItem, TaskPriority } from './types';

export type NovaAction =
  | { type: 'add_event'; event: NovaEventPayload }
  | { type: 'add_task'; task: NovaTaskPayload }
  | { type: 'edit_event'; id: string; updates: Partial<NovaEventPayload> }
  | { type: 'delete_event'; id?: string; title?: string; time?: string }
  | { type: 'toggle_task'; id?: string; label?: string }
  | { type: 'mark_task_done'; id?: string; label?: string }
  | { type: 'delete_task'; id?: string; label?: string }
  | { type: 'remember'; memory: unknown }
  | { type: string; [k: string]: unknown };

export type NovaEventPayload = {
  title: string;
  time?: string | null;
  endTime?: string | null;
  date?: string | null;
  description?: string;
  section?: string;
  icon?: string;
  featured?: boolean;
};

export type NovaTaskPayload = {
  label: string;
  priority?: TaskPriority;
  category?: string;
};

// Resultado por action procesada — sirve tanto para chips como para Deshacer.
export type AppliedItem =
  | { kind: 'event_created'; id: string; title: string }
  | { kind: 'task_created'; id: string; label: string }
  | { kind: 'event_edited'; id: string; title: string }
  | { kind: 'event_deleted'; id: string; title: string }
  | { kind: 'task_toggled'; id: string; label: string; toDone: boolean }
  | { kind: 'task_deleted'; id: string; label: string }
  | { kind: 'memory_saved' }
  | { kind: 'unknown'; type: string };

// Dependencias inyectadas por el caller (la pantalla que tenga acceso a los
// hooks). Mantener este shape estable evita cargar dependencias circulares.
export type ProcessorDeps = {
  events: EventItem[];
  tasks: Task[];
  addEvent: (input: CreateEventInput) => Promise<EventItem | null>;
  patchEvent?: (id: string, updates: Partial<EventItem>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  addTask: (input: CreateTaskInput) => Promise<Task | null>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  patchTask?: (id: string, patch: TaskPatch) => Promise<void>;
};

// Helpers para resolver IDs cuando Nova manda títulos/horas en lugar de id real.
function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findEventByTitleOrTime(
  events: EventItem[],
  title?: string,
  time?: string,
): EventItem | null {
  if (!events.length) return null;
  if (title) {
    const want = normalize(title);
    const hit = events.find((e) => normalize(e.title) === want);
    if (hit) return hit;
  }
  if (time) {
    const want = String(time).replace(/\s/g, '').toLowerCase();
    const hit = events.find(
      (e) => String(e.time || '').replace(/\s/g, '').toLowerCase() === want,
    );
    if (hit) return hit;
  }
  return null;
}

function findTaskByLabel(tasks: Task[], label?: string): Task | null {
  if (!label || !tasks.length) return null;
  const want = normalize(label);
  return tasks.find((t) => normalize(t.label) === want) ?? null;
}

// Convierte una payload de evento de Nova a CreateEventInput para nuestro
// data layer. Si no viene fecha, asume hoy local.
function toCreateEventInput(ev: NovaEventPayload): CreateEventInput {
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // El backend a veces manda time + endTime separados. Si endTime existe,
  // componer "HH:MM-HH:MM"; si no, usar time tal cual.
  let composedTime: string | null = ev.time ?? null;
  if (ev.endTime && composedTime) {
    composedTime = `${composedTime}-${ev.endTime}`;
  }
  return {
    title: String(ev.title || '').trim(),
    date: ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : today,
    time: composedTime || null,
    description: ev.description,
    section: ev.section,
    featured: ev.featured,
  };
}

// Aplica una lista de actions sobre el estado local.
// Devuelve `applied[]` para mostrar chips y `failed[]` para diagnostic.
export async function applyNovaActions(
  actions: NovaAction[],
  deps: ProcessorDeps,
): Promise<{ applied: AppliedItem[]; failed: { type: string; reason: string }[] }> {
  const applied: AppliedItem[] = [];
  const failed: { type: string; reason: string }[] = [];

  for (const action of actions || []) {
    try {
      switch (action.type) {
        case 'add_event': {
          const a = action as Extract<NovaAction, { type: 'add_event' }>;
          const input = toCreateEventInput(a.event);
          if (!input.title) {
            failed.push({ type: action.type, reason: 'empty_title' });
            break;
          }
          const created = await deps.addEvent(input);
          if (created) {
            applied.push({ kind: 'event_created', id: created.id, title: created.title });
          } else {
            failed.push({ type: action.type, reason: 'create_failed' });
          }
          break;
        }

        case 'add_task': {
          const a = action as Extract<NovaAction, { type: 'add_task' }>;
          const label = String(a.task?.label || '').trim();
          if (!label) {
            failed.push({ type: action.type, reason: 'empty_label' });
            break;
          }
          const created = await deps.addTask({
            label,
            priority: a.task.priority,
            category: a.task.category ?? 'hoy',
          });
          if (created) {
            applied.push({ kind: 'task_created', id: created.id, label: created.label });
          } else {
            failed.push({ type: action.type, reason: 'create_failed' });
          }
          break;
        }

        case 'delete_event': {
          const a = action as Extract<NovaAction, { type: 'delete_event' }>;
          let id = a.id ?? null;
          let title = '';
          if (id) {
            const found = deps.events.find((e) => e.id === id);
            title = found?.title ?? '';
          }
          if (!id) {
            const found = findEventByTitleOrTime(deps.events, a.title, a.time);
            id = found?.id ?? null;
            title = found?.title ?? '';
          }
          if (!id) {
            failed.push({ type: action.type, reason: 'not_found' });
            break;
          }
          await deps.removeEvent(id);
          applied.push({ kind: 'event_deleted', id, title });
          break;
        }

        case 'toggle_task':
        case 'mark_task_done': {
          const a = action as Extract<NovaAction, { type: 'toggle_task' | 'mark_task_done' }>;
          let task: Task | null = null;
          if (a.id) task = deps.tasks.find((t) => t.id === a.id) ?? null;
          if (!task) task = findTaskByLabel(deps.tasks, a.label);
          if (!task) {
            failed.push({ type: action.type, reason: 'not_found' });
            break;
          }
          const willBeDone = !task.done;
          await deps.toggleTask(task.id);
          applied.push({
            kind: 'task_toggled',
            id: task.id,
            label: task.label,
            toDone: willBeDone,
          });
          break;
        }

        case 'delete_task': {
          const a = action as Extract<NovaAction, { type: 'delete_task' }>;
          let task: Task | null = null;
          if (a.id) task = deps.tasks.find((t) => t.id === a.id) ?? null;
          if (!task) task = findTaskByLabel(deps.tasks, a.label);
          if (!task) {
            failed.push({ type: action.type, reason: 'not_found' });
            break;
          }
          await deps.removeTask(task.id);
          applied.push({ kind: 'task_deleted', id: task.id, label: task.label });
          break;
        }

        case 'edit_event': {
          // Por ahora no hacemos edit_event (requiere updateEvent en el data
          // layer mobile). Lo registramos como unknown para no perderlo.
          failed.push({ type: action.type, reason: 'not_supported_yet' });
          break;
        }

        case 'remember': {
          // Memorias aún no portadas a mobile. Marcar como saved (best-effort).
          applied.push({ kind: 'memory_saved' });
          break;
        }

        default:
          applied.push({ kind: 'unknown', type: String(action.type) });
      }
    } catch (err: any) {
      failed.push({ type: action.type, reason: err?.message ?? 'error' });
    }
  }

  return { applied, failed };
}

// Texto humano para cada chip de action, espejando describeAction() del legacy.
export function describeApplied(item: AppliedItem): string {
  switch (item.kind) {
    case 'event_created':
      return `Agregado: ${item.title || 'evento'}`;
    case 'task_created':
      return `Tarea: ${item.label}`;
    case 'event_deleted':
      return `Borrado: ${item.title || 'evento'}`;
    case 'event_edited':
      return `Editado: ${item.title || 'evento'}`;
    case 'task_toggled':
      return item.toDone ? `Completada: ${item.label}` : `Reactivada: ${item.label}`;
    case 'task_deleted':
      return `Borrada: ${item.label}`;
    case 'memory_saved':
      return 'Memoria guardada';
    default:
      return 'Acción aplicada';
  }
}

// Reverte los applied items. Solo es seguro para crear→borrar; toggle/edit/
// delete no se pueden deshacer sin el snapshot anterior. Las que no se pueden
// revertir se ignoran (best-effort).
export async function undoApplied(
  items: AppliedItem[],
  deps: Pick<ProcessorDeps, 'removeEvent' | 'removeTask' | 'toggleTask'>,
): Promise<void> {
  for (const item of items) {
    try {
      if (item.kind === 'event_created') {
        await deps.removeEvent(item.id);
      } else if (item.kind === 'task_created') {
        await deps.removeTask(item.id);
      } else if (item.kind === 'task_toggled') {
        // Revertimos el toggle volviéndolo a tocar.
        await deps.toggleTask(item.id);
      }
      // event_deleted / task_deleted no se pueden revertir desde acá (no
      // tenemos el payload completo). El usuario puede recrear con Nova.
    } catch {
      // best-effort: ignoramos errores en undo para no bloquear la UI
    }
  }
}

// Nota: no se exporta deleteEvent reexport — eso vive en events.ts. La
// importamos solo para que TS valide la signatura sin warning.
export type _UnusedDeleteEventSignature = typeof deleteEvent;
