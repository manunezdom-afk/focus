import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { withAuthRetry } from '../lib/authRetry';
import {
  fetchUserProfile,
  type NovaPersonality,
  updateNovaPersonality,
  type UserProfile,
} from './userProfile';

type State = {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

const INITIAL: State = { profile: null, loading: true, saving: false, error: null };

// Cache module-level — el profile cambia poco (la personalidad se elige
// una vez y se queda). TTL 5min.
const STALE_MS = 5 * 60_000;
const _cache = new Map<string, { profile: UserProfile; at: number }>();

export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async () => {
    if (!userId) {
      setState({ profile: null, loading: false, saving: false, error: null });
      return;
    }
    const cached = _cache.get(userId);
    if (cached && Date.now() - cached.at < STALE_MS) {
      setState({ profile: cached.profile, loading: false, saving: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: !s.profile, error: null }));
    try {
      const profile = await withAuthRetry(() => fetchUserProfile(userId), 'fetchUserProfile');
      _cache.set(userId, { profile, at: Date.now() });
      setState({ profile, loading: false, saving: false, error: null });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err?.message ?? 'profile_fetch_failed',
      }));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setNovaPersonality = useCallback(
    async (personality: NovaPersonality): Promise<boolean> => {
      if (!userId) return false;
      const before = state.profile;
      // Optimistic update.
      setState((s) => ({
        ...s,
        saving: true,
        profile: s.profile
          ? { ...s.profile, novaPersonality: personality }
          : { id: userId, novaPersonality: personality },
        error: null,
      }));
      try {
        await withAuthRetry(
          () => updateNovaPersonality(userId, personality),
          'updateNovaPersonality',
        );
        const next = { id: userId, novaPersonality: personality };
        _cache.set(userId, { profile: next, at: Date.now() });
        setState((s) => ({ ...s, saving: false, profile: next }));
        return true;
      } catch (err: any) {
        // Rollback.
        setState((s) => ({
          ...s,
          saving: false,
          profile: before,
          error: err?.message ?? 'update_personality_failed',
        }));
        return false;
      }
    },
    [userId, state.profile],
  );

  return {
    profile: state.profile,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    setNovaPersonality,
    refresh: load,
  };
}
