import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Variables EXPO_PUBLIC_*: Expo las inyecta en el bundle del cliente. NUNCA
// poner acá la service-role key (eso vive solo en el backend de Vercel).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Log warning pero no tirar — la app puede arrancar y mostrar un mensaje en
  // login pidiendo configurar `.env`. Tirar acá rompe el splash screen.
  if (__DEV__) {
    console.warn(
      '[Focus mobile] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copia mobile/.env.example a mobile/.env y completa los valores del proyecto Supabase.',
    );
  }
}

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // AsyncStorage sobrevive a relanzamientos de la app y a updates OTA;
          // suficiente para un PoC mobile. Si en el futuro guardamos el refresh
          // token en lugar más seguro, usar expo-secure-store con un wrapper.
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // En mobile no hay URL bar: la sesión nunca se entrega via redirect,
          // siempre via verifyOtp(). Apagar detectSessionInUrl evita parsing
          // innecesario y un crash conocido en algunas versiones de RN cuando
          // el polyfill de URL recibe un string vacío.
          detectSessionInUrl: false,
          flowType: 'pkce',
          // storageKey distinto del web (`focus-auth`) para que si algún día se
          // comparte storage (ej: pruebas en simulator) no colisione.
          storageKey: 'focus-mobile-auth',
        },
      })
    : null;

// Refrescá el token cuando la app vuelve del background. Sin esto, la sesión
// puede quedar expirada al volver a abrir la app después de >1h y la primera
// llamada a la API tira 401. Patrón recomendado por la doc oficial de Supabase
// para React Native.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
