import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

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

// Cache module-level compartido entre todas las instancias de useTasks()
// (Mi Día, Nova, Tareas). Evita 3 fetches independientes al navegar entre tabs.
// TTL de 30s: dato fresco → servido desde caché; dato viejo → re-fetch.
// Las mutaciones invalidan la entrada (delete) para que el próximo focus re-fetche.
const STALE_MS = 30_000;
type CacheEntry = { data: Task[]; at: number };
const _cache = new Map<string, CacheEntry>();

// In-flight dedup: si ya hay una request en vuelo para este userId,
// ambas instancias esperan el mismo promise en lugar de disparar dos.
const _inFlight = new Map<string, Promise<Task[]>>();

export function useTasks() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  // Ref que siempre apunta al último state — permite leer en callbacks
  // sin poner `state` en deps (evita recrear funciones en cada render).
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setState({ tasks: [], loading: false, refreshing: false, error: null });
        return;
      }

      // TTL guard: en modo 'initial', si la caché es reciente, servir desde ahí.
      if (mode === 'initial') {
        const cached = _cache.get(userId);
        if (cached && Date.now() - cached.at < STALE_MS) {
          // Si el state ya tiene datos (otra instancia ya cargó), no hacer nada.
          if (stateRef.current.tasks.length > 0) return;
          // State vacío: poblar desde caché para que la pantalla no muestre spinner.
          setState({ tasks: cached.data, loading: false, refreshing: false, error: null });
          return;
        }
      }

      setState((s) => ({
        ...s,
        loading: mode === 'initial' && s.tasks.length === 0,
        refreshing: mode === 'refresh',
        error: null,
      }));

      try {
        // Dedup: reutilizar request en vuelo si la hay.
        let promise = _inFlight.get(userId);
        if (!promise) {
          promise = fetchTasks(userId);
          _inFlight.set(userId, promise);
          promise.finally(() => _inFlight.delete(userId));
        }
        const tasks = await promise;
        _cache.set(userId, { data: tasks, at: Date.now() });
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
        setState((s) => ({ ...s, tasks: [created, ...s.tasks] }));
        // Invalidar caché para que otras instancias re-fetchen al ganar foco.
        _cache.delete(userId);
        return created;
      } catch (err: any) {
        setState((s) => ({ ...s, error: err?.message ?? 'create_failed' }));
        return null;
      }
    },
    [userId],
  );

  // toggleTask lee de stateRef (no de state capturado) → función estable
  // que no se recrea en cada cambio de la lista. Evita re-renders en TaskRow.
  const toggleTask = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;
      const current = stateRef.current.tasks.find((t) => t.id === id);
      if (!current) return;
      const nextDone = !current.done;
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, done: nextDone, doneAt: nextDone ? Date.now() : null } : t,
        ),
      }));
      _cache.delete(userId);
      try {
        await apiSetTaskDone(userId, id, nextDone);
      } catch (err: any) {
        // Revertir al estado anterior si el backend rechazó.
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: current.done, doneAt: current.doneAt } : t,
          ),
          error: err?.message ?? 'toggle_failed',
        }));
      }
    },
    [userId],
  );

  const removeTask = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;
      const before = stateRef.current.tasks;
      setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      _cache.delete(userId);
      try {
        await apiDeleteTask(userId, id);
      } catch (err: any) {
        setState((s) => ({ ...s, tasks: before, error: err?.message ?? 'delete_failed' }));
      }
    },
    [userId],
  );

  const patchTask = useCallback(
    async (id: string, patch: TaskPatch): Promise<void> => {
      if (!userId) return;
      const before = stateRef.current.tasks;
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      _cache.delete(userId);
      try {
        await apiUpdateTask(userId, id, patch);
      } catch (err: any) {
        setState((s) => ({ ...s, tasks: before, error: err?.message ?? 'update_failed' }));
      }
    },
    [userId],
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
