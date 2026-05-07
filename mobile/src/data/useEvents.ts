import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  fetchTodayEvents,
  type CreateEventInput,
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

// `mode` decide qué cargar:
// · 'today' → solo eventos con date == hoy (Mi Día)
// · 'all'   → últimos 200 eventos del usuario, ordenados por fecha asc (Calendario)
//
// Mismo patrón simple que useTasks: useFocusEffect refresca al ganar foco,
// `refresh()` para pull-to-refresh.
//
// `addEvent` hace optimistic insert (lo metemos al state inmediatamente y
// si falla revertimos). Devuelve el evento creado o null si error.
export function useEvents(mode: Mode = 'all') {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(
    async (loadMode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setState({ events: [], loading: false, refreshing: false, error: null });
        return;
      }
      setState((s) => ({
        ...s,
        loading: loadMode === 'initial' && s.events.length === 0,
        refreshing: loadMode === 'refresh',
        error: null,
      }));
      try {
        const events =
          mode === 'today' ? await fetchTodayEvents(userId) : await fetchEvents(userId);
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
    [userId, mode],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  // Realtime subscription — port de useEvents.js legacy líneas 200-217.
  // Cuando otro device del mismo usuario crea/edita/borra un evento, queremos
  // que la lista se refresque sin pull-to-refresh manual. Supabase Realtime
  // dispara el evento; nosotros refetcheamos en respuesta.
  //
  // En RN/Expo el WebSocket puede morir cuando la app va a background — el
  // status SUBSCRIBED tras un resuscribe nos da una señal para hacer
  // catch-up de cambios perdidos.
  useEffect(() => {
    if (!userId) return;
    const sb = supabase;
    if (!sb) return;
    const channel = sb
      .channel(`events-rt-${userId}-${mode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load('refresh');
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [userId, mode, load]);

  const refresh = useCallback(() => load('refresh'), [load]);

  const addEvent = useCallback(
    async (input: CreateEventInput): Promise<EventItem | null> => {
      if (!userId) return null;
      try {
        const created = await createEvent(userId, input);
        setState((s) => ({ ...s, events: [...s.events, created], error: null }));
        return created;
      } catch (err: any) {
        setState((s) => ({ ...s, error: err?.message ?? 'create_event_failed' }));
        return null;
      }
    },
    [userId],
  );

  const removeEvent = useCallback(
    async (id: string) => {
      if (!userId) return;
      const prev = state.events;
      setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
      try {
        await deleteEvent(userId, id);
      } catch (err: any) {
        // Revertir
        setState((s) => ({ ...s, events: prev, error: err?.message ?? 'delete_event_failed' }));
      }
    },
    [userId, state.events],
  );

  return {
    events: state.events,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    refresh,
    addEvent,
    removeEvent,
  };
}
