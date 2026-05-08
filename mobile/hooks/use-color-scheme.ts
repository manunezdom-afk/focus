// Wrapper sobre useColorScheme de react-native que respeta la preferencia
// explícita del usuario (Sistema / Claro / Oscuro) cuando el
// ThemePreferenceProvider está montado en la raíz del árbol.
//
// Antes era un re-export crudo de react-native. Lo cambiamos para que las
// pantallas no tengan que importar dos hooks distintos según si quieren
// "lo que dice el SO" o "lo que el usuario eligió". Toda la app usa el
// scheme efectivo, que es lo correcto.
//
// Si el provider no está montado (caso edge — tests, storybook), el
// fallback de useThemePreference devuelve 'light' por default y se evita
// crash. Nadie del equipo debería usarlo sin el provider en producción.

import { useThemePreference } from '@/src/theme/ThemePreferenceProvider';

export function useColorScheme(): 'light' | 'dark' {
  const { effective } = useThemePreference();
  return effective;
}
