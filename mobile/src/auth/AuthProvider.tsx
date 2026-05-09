import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { clearNovaHistory } from '../data/novaPersist';
import { supabase } from '../lib/supabase';

type AuthState = {
  // loading: estamos resolviendo si hay sesión persistida en disco. Mientras
  // sea true, las pantallas privadas NO deben renderizar nada que dependa de
  // user (caso típico: parpadeo de "no autenticado" antes de hidratar).
  loading: boolean;
  session: Session | null;
  user: User | null;
  // ready: la sesión inicial fue resuelta al menos una vez. Útil para layouts
  // que necesitan decidir si redirigir a /login.
  ready: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const subscribed = useRef(false);

  useEffect(() => {
    if (!supabase) {
      // Sin client (faltan envs) — marcamos ready=true para que la UI muestre
      // el error de configuración en vez de quedar en splash infinito.
      setLoading(false);
      setReady(true);
      return;
    }

    let cancelled = false;

    // Watchdog: si getSession() no responde en 5s (AsyncStorage corrupto,
    // red colgada en validación de token) marcamos ready de todos modos
    // para que la UI llegue al login en vez de quedar en splash infinito.
    // Si después responde, setSession actualiza la sesión y todo sigue.
    const watchdog = setTimeout(() => {
      if (cancelled || ready) return;
      if (__DEV__) {
        console.warn('[Focus mobile] getSession timeout 5s — assuming no session');
      }
      setLoading(false);
      setReady(true);
    }, 5000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && __DEV__) {
          console.warn('[Focus mobile] getSession error', error.message);
        }
        setSession(data?.session ?? null);
      })
      .finally(() => {
        if (cancelled) return;
        clearTimeout(watchdog);
        setLoading(false);
        setReady(true);
      });

    // onAuthStateChange dispara también con el estado inicial; para evitar
    // doble setSession mantenemos el flag `subscribed` (solo informativo).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      subscribed.current = true;
      setSession(next ?? null);
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      sub?.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      ready,
      session,
      user: session?.user ?? null,
      signOut: async () => {
        if (!supabase) return;
        // Capturamos el userId antes del signOut para poder limpiar el
        // chat persistido de Nova de este usuario. cacheRegistry escucha el
        // evento SIGNED_OUT y vacía los Maps de useEvents/useTasks/etc.
        const uid = session?.user?.id ?? null;
        if (uid) {
          void clearNovaHistory(uid);
        }
        await supabase.auth.signOut();
        // onAuthStateChange limpiará session — pero forzamos por si el listener
        // tarda (UI siente más rápido el logout).
        setSession(null);
      },
      refresh: async () => {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      },
    }),
    [loading, ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
