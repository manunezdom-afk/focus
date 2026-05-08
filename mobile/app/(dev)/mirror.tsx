import { Redirect } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Lazy import — Metro/Hermes elimina el chunk completo en Release porque
// la ruta `(dev)` siempre rebota antes de mount (ver guard `if (!__DEV__)`
// abajo + el guard del `(dev)/_layout.tsx`). Con import estático el
// WebView de LegacyMirror se bundleaba en Release pese a estar gateado por
// UI. Lazy + Suspense rompe la dependencia estática.
const LegacyMirror = lazy(() =>
  import('@/components/dev/LegacyMirror').then((mod) => ({ default: mod.LegacyMirror })),
);

export default function MirrorScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  // Doble guard. Si alguien deep-linkea esta ruta en una build release,
  // rebota al home en vez de cargar el WebView. (También gateado por
  // (dev)/_layout.tsx con Redirect.)
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <Suspense
        fallback={
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.background,
            }}
          >
            <ActivityIndicator color={c.primary} />
          </View>
        }
      >
        <LegacyMirror />
      </Suspense>
    </SafeAreaView>
  );
}
