import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchEvents, fetchTodayEvents } from './events';
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

  const refresh = useCallback(() => load('refresh'), [load]);

  return {
    events: state.events,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    refresh,
  };
}
