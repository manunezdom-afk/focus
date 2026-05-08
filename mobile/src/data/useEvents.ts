import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { withAuthRetry } from '../lib/authRetry';
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  fetchTodayEvents,
  updateEvent,
  type CreateEventInput,
  type EventPatch,
} from './events';
import type { EventItem } from './types';

type Mode = 'today' | 'all';

type State = {
  events: EventItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

const INITIAL: State = { events: [], loading: true, refreshing: false, error: null };

// Cache module-level compartido. La clave es `${userId}:${mode}` para
// separar 'today' (Mi Día) de 'all' (Calendario / Nova).
const STALE_MS = 30_000;
type CacheEntry = { data: EventItem[]; at: number };
const _cache = new Map<string, CacheEntry>();

// In-flight dedup por clave.
const _inFlight = new Map<string, Promise<EventItem[]>>();

export function useEvents(mode: Mode = 'all') {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  // Ref que siempre apunta al último state para acceder en callbacks
  // sin ponerlo en deps (evita que removeEvent/addEvent se recreen por cada cambio).
  const stateRef = useRef(state);
  stateRef.current = state;

  const cacheKey = userId ? `${userId}:${mode}` : null;

  const load = useCallback(
    async (loadMode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !cacheKey) {
        setState({ events: [], loading: false, refreshing: false, error: null });
        return;
      }

      // TTL guard: en 'initial', servir desde caché si los datos son frescos.
      if (loadMode === 'initial') {
        const cached = _cache.get(cacheKey);
        if (cached && Date.now() - cached.at < STALE_MS) {
          if (stateRef.current.events.length > 0) return;
          setState({ events: cached.data, loading: false, refreshing: false, error: null });
          return;
        }
      }

      setState((s) => ({
        ...s,
        loading: loadMode === 'initial' && s.events.length === 0,
        refreshing: loadMode === 'refresh',
        error: null,
      }));

      try {
        // Dedup: reutilizar request en vuelo si ya hay una para esta clave.
        // Si la sesión expiró, withAuthRetry refresca y reintenta una vez.
        let promise = _inFlight.get(cacheKey);
        if (!promise) {
          promise = withAuthRetry(
            () => (mode === 'today' ? fetchTodayEvents(userId) : fetchEvents(userId)),
            'fetchEvents',
          );
          _inFlight.set(cacheKey, promise);
          promise.finally(() => _inFlight.delete(cacheKey));
        }
        const events = await promise;
        _cache.set(cacheKey, { data: events, at: Date.now() });
        setState({ events, loading: false, refreshing: false, error: null });
      } catch (err: any) {
        setState((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          error: err?.message ?? 'unknown_error',
        }));
      }
    },
    [userId, mode, cacheKey],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  const addEvent = useCallback(
    async (input: CreateEventInput): Promise<EventItem | null> => {
      if (!userId || !cacheKey) return null;
      try {
        const created = await createEvent(userId, input);
        setState((s) => ({ ...s, events: [...s.events, created], error: null }));
        // Invalidar ambas variantes del caché para que el Calendario y Mi Día
        // vean el evento nuevo la próxima vez que ganen foco.
        _cache.delete(`${userId}:today`);
        _cache.delete(`${userId}:all`);
        return created;
      } catch (err: any) {
        setState((s) => ({ ...s, error: err?.message ?? 'create_event_failed' }));
        return null;
      }
    },
    [userId, cacheKey],
  );

  // removeEvent lee de stateRef (no de state capturado) → función estable.
  const removeEvent = useCallback(
    async (id: string) => {
      if (!userId || !cacheKey) return;
      const before = stateRef.current.events;
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
      _cache.delete(`${userId}:today`);
      _cache.delete(`${userId}:all`);
      try {
        await deleteEvent(userId, id);
      } catch (err: any) {
        setState((s) => ({ ...s, events: before, error: err?.message ?? 'delete_event_failed' }));
      }
    },
    [userId, cacheKey],
  );

  const patchEvent = useCallback(
    async (id: string, patch: EventPatch): Promise<void> => {
      if (!userId || !cacheKey) return;
      const before = stateRef.current.events;
      setState((s) => ({
        ...s,
        events: s.events.map((e) =>
          e.id === id
            ? {
                ...e,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.time !== undefined ? { time: patch.time ?? '' } : {}),
                ...(patch.date !== undefined ? { date: patch.date } : {}),
                ...(patch.description !== undefined
                  ? { description: patch.description ?? '' }
                  : {}),
                ...(patch.section !== undefined ? { section: patch.section } : {}),
                ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
              }
            : e,
        ),
      }));
      _cache.delete(`${userId}:today`);
      _cache.delete(`${userId}:all`);
      try {
        await updateEvent(userId, id, patch);
      } catch (err: any) {
        setState((s) => ({ ...s, events: before, error: err?.message ?? 'update_event_failed' }));
      }
    },
    [userId, cacheKey],
  );

  return {
    events: state.events,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    refresh,
    addEvent,
    removeEvent,
    patchEvent,
  };
}
