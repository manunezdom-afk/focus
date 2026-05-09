import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';
import { ThemePreferenceProvider } from '@/src/theme/ThemePreferenceProvider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Mantener el splash nativo vivo hasta que el JS lo tome.
// El catch evita que un doble-llamado (strict mode) crashee.
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

// Tiempo mínimo que el boot screen es visible antes de empezar el fade.
// Suficiente para que la transición nativo → JS no se sienta brusca cuando
// auth resuelve instantáneamente desde AsyncStorage. Si auth tarda más, el
// splash se queda hasta que el redirect a (tabs) o (auth) termine.
const BOOT_MIN_MS = 250;
const BOOT_FADE_MS = 380;

// Pantalla de arranque: fondo oscuro + logo + wordmark.
// Se superpone en absoluto sobre todo el Stack hasta que auth esté lista.
function BootScreen() {
  return (
    <Animated.View
      exiting={FadeOut.duration(BOOT_FADE_MS)}
      style={styles.boot}
      pointerEvents="none"
    >
      <Image
        source={require('../assets/images/splash-icon.png')}
        style={styles.bootIcon}
        resizeMode="contain"
      />
      <Text style={styles.bootWordmark}>FOCUS</Text>
    </Animated.View>
  );
}

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

function Shell() {
  const colorScheme = useColorScheme();
  const { ready, session } = useAuth();
  const segments = useSegments();
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  // showBoot controla si el BootScreen overlay está montado.
  // Empieza en true y pasa a false sólo cuando:
  //   1. ready === true (auth resuelta), Y
  //   2. el grupo de ruta actual coincide con el destino esperado según
  //      la sesión: (tabs) si hay sesión, (auth) si no — esto evita que
  //      el overlay se vaya antes de que AuthGate complete el redirect
  //      y se vea un flash de Mi Día vacío camino al login (o al revés), Y
  //   3. han pasado BOOT_MIN_MS desde el mount.
  const [showBoot, setShowBoot] = useState(true);
  const mountRef = useRef(Date.now());

  // Esconder el splash nativo en el primer frame JS pintado para que
  // la transición nativo → JS sea invisible (ambos muestran lo mismo).
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Cuando auth esté lista Y la ruta efectiva ya esté del lado correcto,
  // esperar el resto del mínimo y luego bajar el boot.
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const settled = (session && inTabsGroup) || (!session && inAuthGroup);
    if (!settled) return;
    const elapsed = Date.now() - mountRef.current;
    const remaining = Math.max(0, BOOT_MIN_MS - elapsed);
    const t = setTimeout(() => setShowBoot(false), remaining);
    return () => clearTimeout(t);
  }, [ready, session, segments]);

  return (
    <ThemeProvider value={navTheme}>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(dev)" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style={showBoot ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'} />
      {showBoot && <BootScreen />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const BOOT_BG = '#06080f';

const styles = StyleSheet.create({
  boot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BOOT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    gap: 20,
  },
  bootIcon: {
    width: 100,
    height: 100,
  },
  bootWordmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 9,
    opacity: 0.85,
  },
});
