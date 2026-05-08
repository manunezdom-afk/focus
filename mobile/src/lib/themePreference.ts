import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferencia explícita de apariencia del usuario:
//   'system'  — seguir el systema (default — equivale al comportamiento legacy)
//   'light'   — forzar claro
//   'dark'    — forzar oscuro
//
// Se persiste en AsyncStorage. Lectura es síncrona via cache en memoria
// (poblado al boot por loadThemePreference()), porque el árbol de UI
// necesita saber el scheme antes del primer render para no parpadear.

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'focus.themePreference.v1';

let _cached: ThemePreference = 'system';
let _loaded = false;

export function getCachedThemePreference(): ThemePreference {
  return _cached;
}

export function isThemePreferenceLoaded(): boolean {
  return _loaded;
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      _cached = raw;
    } else {
      _cached = 'system';
    }
  } catch {
    _cached = 'system';
  } finally {
    _loaded = true;
  }
  return _cached;
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  _cached = pref;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Persistencia opcional: si AsyncStorage falla, la preferencia vive
    // en memoria por la sesión y se pierde al cerrar la app.
  }
}
