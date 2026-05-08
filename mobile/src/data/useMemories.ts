import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  type CreateMemoryInput,
  fetchMemories,
  type Memory,
  upsertMemory,
} from './memories';

type State = {
  memories: Memory[];
  loading: boolean;
  error: string | null;
};

const INITIAL: State = { memories: [], loading: true, error: null };

// Cache module-level — las memorias cambian poco; TTL 60s.
const STALE_MS = 60_000;
type CacheEntry = { data: Memory[]; at: number };
const _cache = new Map<string, CacheEntry>();
const _inFlight = new Map<string, Promise<Memory[]>>();

export function useMemories() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(
    async (force = false) => {
      if (!userId) {
        setState({ memories: [], loading: false, error: null });
        return;
      }
      if (!force) {
        const cached = _cache.get(userId);
        if (cached && Date.now() - cached.at < STALE_MS) {
          if (stateRef.current.memories.length > 0) return;
          setState({ memories: cached.data, loading: false, error: null });
          return;
        }
      }
      setState((s) => ({ ...s, loading: s.memories.length === 0, error: null }));
      try {
        let promise = _inFlight.get(userId);
        if (!promise) {
          promise = fetchMemories(userId);
          _inFlight.set(userId, promise);
          promise.finally(() => _inFlight.delete(userId));
        }
        const memories = await promise;
        _cache.set(userId, { data: memories, at: Date.now() });
        setState({ memories, loading: false, error: null });
      } catch (err: any) {
        setState((s) => ({ ...s, loading: false, error: err?.message ?? 'unknown_error' }));
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // addMemory es transparente para el usuario — el chip de Nova ya describe
  // que se "guardó algo". Devolvemos la memoria creada por si el caller la
  // necesita (ej. mostrar en debug).
  const addMemory = useCallback(
    async (input: CreateMemoryInput): Promise<Memory | null> => {
      if (!userId) return null;
      try {
        const created = await upsertMemory(userId, input);
        if (created) {
          setState((s) => ({ ...s, memories: [created, ...s.memories] }));
          _cache.delete(userId);
        }
        return created;
      } catch (err: any) {
        setState((s) => ({ ...s, error: err?.message ?? 'memory_save_failed' }));
        return null;
      }
    },
    [userId],
  );

  return {
    memories: state.memories,
    loading: state.loading,
    error: state.error,
    addMemory,
    refresh: () => load(true),
  };
}
