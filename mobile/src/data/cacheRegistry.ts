// Registry centralizado para limpiar caches module-level al hacer signOut.
//
// Problema que resuelve: useEvents, useTasks, useMemories y useUserProfile
// mantienen Maps `_cache` (TTL) y `_inFlight` (dedup) a nivel módulo.
// Estos Maps SOBREVIVEN al sign-out — sin limpieza, los datos del user A
// quedan en memoria hasta que el user B re-fetchee tras login.
// Riesgo: durante el primer paint del user B, podría ver datos del user A.
//
// Diseño:
//   · Cada hook llama registerCacheClear() con una función que vacía sus Maps.
//   · Al primer evento SIGNED_OUT de Supabase, todas las funciones registradas
//     se ejecutan secuencialmente.
//   · Una sola suscripción global (este archivo) — los hooks no se acoplan a
//     la API de auth ni se suscriben individualmente.

import { supabase } from '../lib/supabase';

const clearFns = new Set<() => void>();

export function registerCacheClear(fn: () => void): void {
  clearFns.add(fn);
}

// Suscripción única al cambio de auth state. Si supabase es null (envs
// faltan) no hacemos nada — la app está rota a otro nivel y los caches
// nunca se llenan.
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      for (const fn of clearFns) {
        try {
          fn();
        } catch {
          // Una falla en un hook no debe impedir limpiar los demás.
        }
      }
    }
  });
}
