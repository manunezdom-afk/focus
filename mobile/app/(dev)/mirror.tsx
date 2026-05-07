import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegacyMirror } from '@/components/dev/LegacyMirror';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function MirrorScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  // Doble guard. Si alguien deep-linkea esta ruta en una build release,
  // rebota al home en vez de cargar el WebView.
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <LegacyMirror />
    </SafeAreaView>
  );
}
