import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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

// Botón visible solo en __DEV__: punto pequeño en la esquina superior
// derecha. Las pantallas tienen header alineado a la izquierda, así que
// la zona superior derecha está libre. Tap abre Migration Mirror. En
// release builds no se renderiza.
function DevMirrorTrigger() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => router.push('/(dev)/mirror')}
      hitSlop={10}
      style={({ pressed }) => ({
        position: 'absolute',
        top: insets.top + 6,
        right: 12,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: pressed ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.28)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      })}
      accessibilityLabel="Abrir Migration Mirror (dev)"
      accessibilityRole="button"
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>M</Text>
    </Pressable>
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
