import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Gate redirige a (auth)/login cuando no hay sesión y a (tabs) cuando sí la
// hay. Vive dentro de <AuthProvider> y usa useSegments para evitar bucles
// (no replace si ya estamos en el destino correcto).
function AuthGate() {
  const { ready, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, session, segments, router]);

  return null;
}

function LoadingSplash({ background }: { background: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
      <ActivityIndicator />
    </View>
  );
}

function Shell() {
  const colorScheme = useColorScheme();
  const { ready } = useAuth();
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  return (
    <ThemeProvider value={navTheme}>
      <AuthGate />
      {ready ? (
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(dev)" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          {__DEV__ ? <DevMirrorTrigger /> : null}
        </View>
      ) : (
        <LoadingSplash background={backgroundColor} />
      )}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

// Trigger oculto solo en __DEV__: zona invisible 28x28 en esquina superior
// izquierda. Long-press (650ms) abre el Migration Mirror. Position: top:0,
// left:0 — área que ninguna pantalla usa para tap. En release builds el
// Pressable no se renderiza y la zona vuelve a ser tappable normalmente.
function DevMirrorTrigger() {
  const router = useRouter();
  return (
    <Pressable
      onLongPress={() => router.push('/(dev)/mirror')}
      delayLongPress={650}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 28,
        height: 28,
        // sin background → completamente invisible
      }}
      accessibilityLabel="Abrir Migration Mirror (dev)"
      accessibilityRole="button"
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
