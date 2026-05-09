// Hook para la Bandeja de Nova. Sigue el patrón de useTasks.ts:
//   - Cache module-level compartido entre instancias (Mi Día badge + pantalla
//     inbox usan la misma fuente; cero double-fetch).
//   - In-flight dedup.
//   - Optimistic updates con rollback.
//   - useFocusEffect para refrescar al volver a la pantalla.
//   - withAuthRetry para reintentar tras 401.
//
// Uso:
//   const inbox = useSuggestions();
//   inbox.suggestions          // Suggestion[] pendientes ordenadas
//   inbox.pendingCount         // number — para el badge
//   inbox.approve(id)          // optimistic remove + retry on fail
//   inbox.reject(id, opts)
//   inbox.snooze(id, preset)
//   inbox.refresh()            // pull-to-refresh

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { withAuthRetry } from '../lib/authRetry';
import { registerCacheClear } from './cacheRegistry';
import {
  approveSuggestion as apiApprove,
  editSuggestion as apiEdit,
  fetchSuggestions,
  rejectSuggestion as apiReject,
  snoozeSuggestion as apiSnooze,
  triggerSelfGeneration,
  type SnoozePreset,
} from './suggestions';
import type { Suggestion } from './types';

type State = {
  suggestions: Suggestion[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  applying: Set<string>; // ids con acción en vuelo (para deshabilitar swipe duplicado)
};

const INITIAL: State = {
  suggestions: [],
  loading: true,
  refreshing: false,
  error: null,
  applying: new Set(),
};

const STALE_MS = 30_000;
type CacheEntry = { data: Suggestion[]; at: number };
const _cache = new Map<string, CacheEntry>();
const _inFlight = new Map<string, Promise<Suggestion[]>>();

// "Hoy" en YYYY-MM-DD UTC para gatear el self-trigger.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
const _lastSelfTrigger = new Map<string, string>(); // userId → todayKey

registerCacheClear(() => {
  _cache.clear();
  _inFlight.clear();
  _lastSelfTrigger.clear();
});

export function useSuggestions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(INITIAL);

  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setState({ suggestions: [], loading: false, refreshing: false, error: null, applying: new Set() });
        return;
      }

      if (mode === 'initial') {
        const cached = _cache.get(userId);
        if (cached && Date.now() - cached.at < STALE_MS) {
          if (stateRef.current.suggestions.length > 0) return;
          setState({ suggestions: cached.data, loading: false, refreshing: false, error: null, applying: new Set() });
          return;
        }
      }

      setState((s) => ({
        ...s,
        loading: mode === 'initial' && s.suggestions.length === 0,
        refreshing: mode === 'refresh',
        error: null,
      }));

      try {
        let promise = _inFlight.get(userId);
        if (!promise) {
          promise = withAuthRetry(async () => {
            const { suggestions } = await fetchSuggestions();
            return suggestions;
          }, 'fetchSuggestions');
          _inFlight.set(userId, promise);
          promise.finally(() => _inFlight.delete(userId));
        }
        const suggestions = await promise;
        _cache.set(userId, { data: suggestions, at: Date.now() });
        setState((s) => ({ ...s, suggestions, loading: false, refreshing: false, error: null }));
      } catch (err: any) {
        if (__DEV__) {
          console.warn('[useSuggestions] fetch failed:', err?.message ?? err, 'code:', err?.code);
        }
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

  // 1ª vez del día: pedir al backend que evalúe reglas (overdue / overload).
  // Es best-effort — el endpoint es idempotente y respeta el "1 por kind por
  // día"; si ya generó hoy no crea duplicados.
  useEffect(() => {
    if (!userId) return;
    const today = todayKey();
    if (_lastSelfTrigger.get(userId) === today) return;
    _lastSelfTrigger.set(userId, today);
    triggerSelfGeneration().then((result) => {
      if (result.created > 0) {
        // Hubo nuevas: invalidar caché y re-cargar.
        _cache.delete(userId);
        void load('refresh');
      }
    });
  }, [userId, load]);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const refresh = useCallback(async () => {
    if (userId) {
      // Pull-to-refresh dispara también la re-evaluación de reglas. Si el
      // usuario acaba de marcar como done una tarea vencida, el overdue_batch
      // podría desaparecer en el siguiente generate.
      _lastSelfTrigger.set(userId, todayKey());
      await triggerSelfGeneration();
    }
    await load('refresh');
  }, [load, userId]);

  // Helper compartido: marca una sugerencia como "applying", la quita
  // optimistamente, ejecuta la API call, y revierte si falla.
  const runResolve = useCallback(
    async (
      id: string,
      apiCall: () => Promise<unknown>,
      errCtx: string,
    ): Promise<{ ok: true } | { ok: false; error: string; code?: string }> => {
      if (!userId) return { ok: false, error: 'no_session' };
      const before = stateRef.current.suggestions;
      const target = before.find((s) => s.id === id);
      if (!target) return { ok: false, error: 'not_found' };

      setState((s) => {
        const applying = new Set(s.applying);
        applying.add(id);
        return {
          ...s,
          suggestions: s.suggestions.filter((x) => x.id !== id),
          applying,
        };
      });
      _cache.delete(userId);

      try {
        await apiCall();
        setState((s) => {
          const applying = new Set(s.applying);
          applying.delete(id);
          return { ...s, applying };
        });
        return { ok: true };
      } catch (err: any) {
        if (__DEV__) console.warn(`[useSuggestions] ${errCtx} failed:`, err?.message);
        setState((s) => {
          const applying = new Set(s.applying);
          applying.delete(id);
          return {
            ...s,
            suggestions: before, // revertir lista entera (mantiene orden)
            applying,
            error: err?.message ?? errCtx,
          };
        });
        return { ok: false, error: err?.message ?? errCtx, code: err?.code };
      }
    },
    [userId],
  );

  const approve = useCallback(
    (id: string) => runResolve(id, () => apiApprove(id), 'approve_failed'),
    [runResolve],
  );

  const reject = useCallback(
    (id: string, opts: { dismissKind?: boolean; reason?: string } = {}) =>
      runResolve(id, () => apiReject(id, opts), 'reject_failed'),
    [runResolve],
  );

  const snooze = useCallback(
    (id: string, preset: SnoozePreset | string) =>
      runResolve(id, () => apiSnooze(id, preset), 'snooze_failed'),
    [runResolve],
  );

  const edit = useCallback(
    async (id: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
      if (!userId) return { ok: false, error: 'no_session' };
      try {
        await apiEdit(id, payload);
        // Edit deja la card pending — re-fetch para obtener payload actualizado.
        _cache.delete(userId);
        await load('refresh');
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message ?? 'edit_failed' };
      }
    },
    [load, userId],
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    suggestions: state.suggestions,
    pendingCount: state.suggestions.length,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    isApplying: (id: string) => state.applying.has(id),
    refresh,
    approve,
    reject,
    snooze,
    edit,
    clearError,
  };
}
