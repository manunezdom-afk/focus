import { Redirect, Stack } from 'expo-router';

// Grupo de rutas dev-only. En builds release (__DEV__ === false) cualquier
// intento de entrar acá rebota al home. La pantalla `mirror.tsx` también
// agrega su propio guard.
export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Atrás',
        headerTitleStyle: { fontSize: 16, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="mirror" options={{ title: 'Migration Mirror' }} />
    </Stack>
  );
}
