// Port de src/hooks/useAppPreferences.js para mobile.
//
// Diferencia clave: localStorage → AsyncStorage. El resto es el mismo
// patrón: estado React + persistencia + sanitize.
//
// Solo portamos `novaPersonality` por ahora (es lo que Nova lee). Otras
// preferencias (defaultDurationBehavior) las dejamos para fases siguientes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'focus_app_prefs_v1';

// Personalidades válidas — alineado con src/utils/novaPersonality.js
const VALID_PERSONALITIES = ['focus', 'calm', 'sharp', 'warm'] as const;
export type NovaPersonality = (typeof VALID_PERSONALITIES)[number];
const DEFAULT_NOVA_PERSONALITY: NovaPersonality = 'focus';

export type AppPreferences = {
  novaPersonality: NovaPersonality;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  novaPersonality: DEFAULT_NOVA_PERSONALITY,
};

function sanitize(raw: any): AppPreferences {
  const out = { ...DEFAULT_PREFERENCES };
  if (raw && typeof raw === 'object') {
    if (VALID_PERSONALITIES.includes(raw.novaPersonality)) {
      out.novaPersonality = raw.novaPersonality;
    }
  }
  return out;
}

async function readFromStorage(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

async function writeToStorage(prefs: AppPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
}

// Para lectura síncrona desde handlers fuera de React (ej: el body request a
// Nova, donde no podemos awaitar). Mantenemos un cache en memoria que se
// hidrata al primer mount del hook.
let memCache: AppPreferences = { ...DEFAULT_PREFERENCES };
let memHydrated = false;

export function readPreferenceSync<K extends keyof AppPreferences>(
  key: K,
): AppPreferences[K] {
  return memCache[key];
}

export function useAppPreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(memCache);
  const [loaded, setLoaded] = useState(memHydrated);

  // Hidrata desde AsyncStorage la primera vez
  useEffect(() => {
    if (memHydrated) return;
    let mounted = true;
    void readFromStorage().then((p) => {
      memCache = p;
      memHydrated = true;
      if (mounted) {
        setPrefs(p);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback(
    <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        memCache = next;
        void writeToStorage(next);
        return next;
      });
    },
    [],
  );

  return { prefs, loaded, setPreference };
}
