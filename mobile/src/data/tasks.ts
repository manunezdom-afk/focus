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
  };
}

export async function fetchTasks(userId: string): Promise<Task[]> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, label, done, priority, category, done_at, created_at, updated_at')
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
};

export async function createTask(userId: string, input: CreateTaskInput): Promise<Task> {
  if (!supabase) throw new Error('supabase_not_configured');
  const trimmed = input.label.trim();
  if (!trimmed) throw new Error('empty_label');
  const id = newTaskId();
  const row = {
    id,
    user_id: userId,
    label: trimmed,
    done: false,
    priority: input.priority ?? 'Media',
    category: input.category ?? 'hoy',
    done_at: null as number | null,
  };
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
