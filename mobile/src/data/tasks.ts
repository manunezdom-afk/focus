import { supabase } from '../lib/supabase';
import { newTaskId } from './ids';
import type { Task, TaskPriority } from './types';

// Patrón espejo de src/services/dataService.js de la web. RLS garantiza que
// auth.uid() = user_id, pero filtramos también por user_id explícitamente
// para que el query se planifique mejor y para defensa en profundidad si la
// policy se rompiera por error de migración.

type TaskRow = {
  id: string;
  user_id: string;
  label: string;
  done: boolean | null;
  priority: string | null;
  category: string | null;
  done_at: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Campos opcionales — solo presentes si las migraciones 016/017 están
  // aplicadas. El SELECT '*' los trae si existen, undefined si no.
  parent_task_id?: string | null;
  linked_event_id?: string | null;
  due_date?: string | null;
  due_time?: string | null;
};

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    label: row.label,
    done: !!row.done,
    priority: ((row.priority as TaskPriority) ?? 'Media'),
    category: row.category ?? 'hoy',
    doneAt: row.done_at,
    createdAt: row.created_at,
    parentTaskId: row.parent_task_id ?? null,
    linkedEventId: row.linked_event_id ?? null,
    dueDate: row.due_date ?? null,
    dueTime: row.due_time ?? null,
  };
}

export async function fetchTasks(userId: string): Promise<Task[]> {
  if (!supabase) throw new Error('supabase_not_configured');
  // SELECT '*' en lugar de enumerar columnas: si las migraciones 016/017
  // todavía no se aplicaron en el server, los campos parent_task_id /
  // linked_event_id / due_date / due_time simplemente no vienen y el
  // converter pone null. Si están aplicadas, los devuelve sin tocar nada.
  // Trade-off: la fila pesa unos bytes más; aceptable para tareas (tabla
  // chica) y nos da tolerancia a migración pendiente.
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('done', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as TaskRow));
}

export type CreateTaskInput = {
  label: string;
  priority?: TaskPriority;
  category?: string;
  // Opcionales — requieren migration 016/017 aplicada en el server. Si no
  // se setean, no se incluyen en el INSERT (defensivo: mantiene compat
  // con DB sin los campos nuevos).
  parentTaskId?: string | null;
  linkedEventId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
};

export async function createTask(userId: string, input: CreateTaskInput): Promise<Task> {
  if (!supabase) throw new Error('supabase_not_configured');
  const trimmed = input.label.trim();
  if (!trimmed) throw new Error('empty_label');
  const id = newTaskId();
  // Solo agregamos los campos nuevos si vinieron seteados. Cuando las
  // migrations 016/017 aún no están aplicadas, el INSERT con esas
  // columnas explotaría con error 42703 ("column does not exist"). Si
  // el caller no setea, no las incluimos y la query funciona idéntico
  // al comportamiento pre-migración.
  const row: Record<string, unknown> = {
    id,
    user_id: userId,
    label: trimmed,
    done: false,
    priority: input.priority ?? 'Media',
    category: input.category ?? 'hoy',
    done_at: null,
  };
  if (input.parentTaskId !== undefined) row.parent_task_id = input.parentTaskId;
  if (input.linkedEventId !== undefined) row.linked_event_id = input.linkedEventId;
  if (input.dueDate !== undefined) row.due_date = input.dueDate;
  if (input.dueTime !== undefined) row.due_time = input.dueTime;
  const { error } = await supabase.from('tasks').insert(row);
  if (error) throw error;
  return fromRow(row as unknown as TaskRow);
}

export async function setTaskDone(userId: string, id: string, done: boolean): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase
    .from('tasks')
    .update({
      done,
      // doneAt es BIGINT epoch ms en la tabla — mismo formato que escribe la web.
      done_at: done ? Date.now() : null,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// Update parcial — cambiar priority o category sin tocar el resto. Mismo
// patrón que la web (updateTask en dataService.js).
export type TaskPatch = {
  priority?: TaskPriority;
  category?: string;
  label?: string;
  // Estos requieren migration 016/017. Si la columna no existe aún en
  // server, el UPDATE explotará con 42703 — el caller debe esperar a
  // que se aplique la migración antes de exponer la UI que los setea.
  dueDate?: string | null;
  dueTime?: string | null;
  parentTaskId?: string | null;
  linkedEventId?: string | null;
};

export async function updateTask(userId: string, id: string, patch: TaskPatch): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  if (Object.keys(patch).length === 0) return;
  // Mapear las keys camelCase del patch a snake_case de DB. Las que no
  // están en el patch no se incluyen — Supabase update omite columnas
  // ausentes (no las pone NULL).
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.dueTime !== undefined) row.due_time = patch.dueTime;
  if (patch.parentTaskId !== undefined) row.parent_task_id = patch.parentTaskId;
  if (patch.linkedEventId !== undefined) row.linked_event_id = patch.linkedEventId;
  const { error } = await supabase
    .from('tasks')
    .update(row)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
