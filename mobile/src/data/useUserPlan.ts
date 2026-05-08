import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { registerCacheClear } from './cacheRegistry';
import { fetchUserPlan, type UserPlanInfo } from './userPlan';

type State = {
  data: UserPlanInfo | null;
  loading: boolean;
  error: string | null;
};

const INITIAL: State = { data: null, loading: true, error: null };

// Cache module-level — el plan cambia muy poco (admin lo cambia una vez,
// usuario nunca lo edita él mismo). TTL 5 min: suficiente para que el
// uso de Nova se actualice si abrís Ajustes después de chatear.
const STALE_MS = 5 * 60_000;
const _cache = new Map<string, { data: UserPlanInfo; at: number }>();

registerCacheClear(() => {
  _cache.clear();
});

// Hook simple — fetch al ganar foco la pantalla, cache de 5 min, sin
// optimistic updates (read-only). El componente decide si mostrar
// loading/error o solo el dato.
export function useUserPlan() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async () => {
    if (!userId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const cached = _cache.get(userId);
    if (cached && Date.now() - cached.at < STALE_MS) {
      setState({ data: cached.data, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: !s.data, error: null }));
    try {
      const data = await fetchUserPlan();
      _cache.set(userId, { data, at: Date.now() });
      setState({ data, loading: false, error: null });
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err?.message ?? 'fetch_failed' }));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh: load,
  };
}
