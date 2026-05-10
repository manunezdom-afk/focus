// Variante web — espejo del archivo native (use-color-scheme.ts) que
// respeta la preferencia del usuario (Sistema / Claro / Oscuro) via
// ThemePreferenceProvider. Para SSR/static rendering, el primer paint
// usa 'light' hasta que React hidrata; luego el provider toma el valor
// efectivo.

import { useEffect, useState } from 'react';

import { useThemePreference } from '@/src/theme/ThemePreferenceProvider';

export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { effective } = useThemePreference();

  if (hasHydrated) {
    return effective;
  }

  return 'light';
}
