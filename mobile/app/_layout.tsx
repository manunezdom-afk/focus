import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(dev)" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      ) : (
        <LoadingSplash background={backgroundColor} />
      )}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
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
