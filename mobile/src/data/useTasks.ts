import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  fetchTasks,
  setTaskDone as apiSetTaskDone,
  updateTask as apiUpdateTask,
  type CreateTaskInput,
  type TaskPatch,
} from './tasks';
import type { Task } from './types';

type State = {
  tasks: Task[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

const INITIAL: State = { tasks: [], loading: true, refreshing: false, error: null };

// Hook simple para Fase 2: sin caché en disco, sin realtime, sin pending
// upserts. Las pantallas usan `useFocusEffect` para refrescar al volver y
// `refresh()` para pull-to-refresh. Optimistic UI sí — la lista actualiza
// antes de que Supabase confirme para que el toggle/delete sienta instantáneo.
//
// Cuando agreguemos realtime/offline, usar useTasks de la web como referencia
// (src/hooks/useTasks.js) — tiene el patrón completo con dedupe + escudo de
// upserts pendientes.
export function useTasks() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setState({ tasks: [], loading: false, refreshing: false, error: null });
        return;
      }
      setState((s) => ({
        ...s,
        loading: mode === 'initial' && s.tasks.length === 0,
        refreshing: mode === 'refresh',
        error: null,
      }));
      try {
        const tasks = await fetchTasks(userId);
        setState({ tasks, loading: false, refreshing: false, error: null });
      } catch (err: any) {
        setState((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          error: err?.message ?? 'unknown_error',
        }));
      }
    },
    [userId],
  );

  // useFocusEffect dispara cada vez que la pantalla gana foco (incluida la
  // primera vez) y limpia al perderlo. Cubre: navegación entre tabs, volver
  // del background, primera carga.
  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  const addTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      if (!userId) return null;
      try {
        const created = await apiCreateTask(userId, input);
        // Optimistic: agregar al tope (la query ordena `done ASC, created_at DESC`
        // así que las nuevas pendientes van arriba).
        setState((s) => ({ ...s, tasks: [created, ...s.tasks] }));
        return created;
      } catch (err: any) {
        setState((s) => ({ ...s, error: err?.message ?? 'create_failed' }));
        return null;
      }
    },
    [userId],
  );

  const toggleTask = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;
      const current = state.tasks.find((t) => t.id === id);
      if (!current) return;
      const nextDone = !current.done;
      // Optimistic update — la pantalla siente el toggle al instante.
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, done: nextDone, doneAt: nextDone ? Date.now() : null } : t,
        ),
      }));
      try {
        await apiSetTaskDone(userId, id, nextDone);
      } catch (err: any) {
        // Revertir si el backend rechazó.
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: current.done, doneAt: current.doneAt } : t,
          ),
          error: err?.message ?? 'toggle_failed',
        }));
      }
    },
    [userId, state.tasks],
  );

  const removeTask = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;
      const before = state.tasks;
      // Optimistic: sacarla de la lista al instante.
      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      try {
        await apiDeleteTask(userId, id);
      } catch (err: any) {
        // Revertir si falló.
        setState((s) => ({ ...s, tasks: before, error: err?.message ?? 'delete_failed' }));
      }
    },
    [userId, state.tasks],
  );

  const patchTask = useCallback(
    async (id: string, patch: TaskPatch): Promise<void> => {
      if (!userId) return;
      const before = state.tasks;
      // Optimistic update: aplicar el patch en cliente al instante.
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      try {
        await apiUpdateTask(userId, id, patch);
      } catch (err: any) {
        setState((s) => ({ ...s, tasks: before, error: err?.message ?? 'update_failed' }));
      }
    },
    [userId, state.tasks],
  );

  return {
    tasks: state.tasks,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    refresh,
    addTask,
    toggleTask,
    removeTask,
    patchTask,
  };
}
