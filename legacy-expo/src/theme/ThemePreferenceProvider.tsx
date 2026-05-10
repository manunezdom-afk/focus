import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  getCachedThemePreference,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/src/lib/themePreference';

type EffectiveScheme = 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  effective: EffectiveScheme;
  setPreference: (pref: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Provider que envuelve el árbol y resuelve la preferencia de apariencia
// del usuario:
//   - Si la preferencia es 'system', usamos useColorScheme() del SO.
//   - Si es 'light' o 'dark', forzamos ese valor.
//
// El loading inicial es asíncrono (AsyncStorage). Mientras carga usamos
// el cache en memoria (default 'system'). El primer paint puede ser
// 'system' por 1 frame y después corregirse — aceptable para evitar
// bloquear el splash con un await del storage.
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    getCachedThemePreference(),
  );

  // Hidratar al mount — solo una vez. Si la preferencia persistida difiere
  // del cache inicial, actualizamos state y todo el árbol se re-renderiza
  // con el scheme correcto.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadThemePreference();
      if (!cancelled && loaded !== preference) setPreferenceState(loaded);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await saveThemePreference(next);
  }, []);

  const effective: EffectiveScheme = useMemo(() => {
    if (preference === 'light') return 'light';
    if (preference === 'dark') return 'dark';
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, effective, setPreference }),
    [preference, effective, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Devuelve el scheme efectivo y la preferencia. Si el provider no está
// montado (caso edge: storybook/tests), cae al sistema.
export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback degradado — no rompemos.
    return {
      preference: 'system',
      effective: 'light',
      setPreference: async () => {},
    };
  }
  return ctx;
}
