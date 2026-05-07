// Limpieza de datos privados del usuario en almacenamiento local.
//
// Hay dos escenarios distintos y los tratamos diferente:
//
// 1. LOGOUT (usuario cierra sesión, puede volver a entrar):
//    Borra TODO contenido del usuario (eventos, tareas, mensajes Nova,
//    perfiles, memorias, push subscription pendiente, etc.) para que
//    nadie con acceso al dispositivo vea sus datos en DevTools, y para
//    que un segundo usuario que use el mismo dispositivo no herede nada.
//    Mantiene flags UX (welcome screen visto, hints dismissed) — esos
//    no son privados, son del dispositivo, y borrarlos haría que el
//    mismo usuario vea de nuevo el onboarding la próxima vez.
//
// 2. DELETE ACCOUNT (usuario pidió borrado total):
//    Borra TODO incluyendo flags UX. El usuario quiso desaparecer del
//    dispositivo; cualquier rastro debe irse.
//
// Lista canónica de TODAS las keys que Focus usa en local/sessionStorage.
// Si agregas una key nueva en el código, agregala acá también — los
// tests verifican que no queden datos huérfanos.

// Datos privados del usuario (incluye prefijos *_<userId>).
const PRIVATE_DATA_PREFIXES = Object.freeze([
  'focus_events',          // global y focus_events_<userId>
  'focus_tasks',           // global y focus_tasks_<userId>
  'focus_suggestions',
  'focus_user_profile',
  'focus_user_memories',
  'focus_user_behavior',
  'focus_migrated',
  'focus_task_links',      // global y focus_task_links_<userId>
  'focus_task_parents',    // global y focus_task_parents_<userId>
  'focus_sync_queue',      // cola offline con writes pendientes
  'focus_signals_queue',   // signals encolados sin upload
  'nova_history',          // historial de Nova (compat)
  'focus_pending_push_sub',// suscripción Web Push pendiente de aplicar
  'focus_pending_native_token', // token APNs pendiente
])

// sessionStorage keys (siempre se limpian en logout — son datos efímeros
// pero pueden contener mensajes de Nova / contexto de sesión).
const SESSION_KEYS = Object.freeze([
  'focus_auth_pending',
  'focus_auth_resend_until',
  'focus_device_pairing',
  'nova_history',
  'focus_pending_nova_seed',
  'focus_aurora_continuity',
])

// Flags UX (son del DISPOSITIVO, no del usuario; en logout NO se borran
// para no romper la UX del próximo login del MISMO usuario).
const UX_FLAG_KEYS = Object.freeze([
  'focus_welcome_last',
  'focus_inbox_demo_dismissed_v1',
  'focus_nova_tutorial_dismissed',
  'focus_onboarding_chips_dismissed',
  'focus_empty_day_banner_dismissed',
  'nova_last_opened',
  'focus_app_prefs_v1',    // preferencias (Nova personality, etc.) — son del usuario pero del dispositivo
])

const UX_FLAG_PREFIXES = Object.freeze([
  'focus_hint_',           // tutoriales una-vez-por-navegador
  'focus:day_started:',    // flag "ya inicié Mi Día hoy"
])

/**
 * Borra datos privados del usuario en localStorage Y sessionStorage.
 * Llamar al hacer logout.
 *
 * Diseño defensivo: recorre todo el localStorage en lugar de borrar keys
 * fijas, porque las keys con prefijo `_<userId>` cambian por usuario.
 *
 * Importante: recolectamos TODAS las keys primero y borramos después
 * — iterar mientras se muta storage hace saltar índices.
 */
export function clearPrivateUserDataLocal() {
  // 1. Snapshot de keys
  const allKeys = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k) allKeys.push(k)
    }
  } catch {}

  // 2. Borrar las que matchean prefijo de dato privado
  try {
    for (const k of allKeys) {
      if (PRIVATE_DATA_PREFIXES.some(p => k === p || k.startsWith(`${p}_`))) {
        localStorage.removeItem(k)
      }
    }
  } catch {}

  // 3. sessionStorage por nombre fijo
  try {
    for (const k of SESSION_KEYS) sessionStorage.removeItem(k)
  } catch {}
}

/**
 * Borra TODOS los datos del usuario, incluyendo flags UX. Llamar después
 * de eliminar la cuenta — el usuario quiso desaparecer y no debe quedar
 * nada que lo identifique en el dispositivo.
 */
export function clearAllUserDataLocal() {
  // 1. Recolectar TODAS las keys primero (evita saltos al iterar mientras
  //    se muta el storage — bug clásico al borrar índices in-place).
  let allKeys = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k) allKeys.push(k)
    }
  } catch {}

  // 2. Privados (prefijos) + UX (nombres fijos + prefijos)
  const matchesPrivate = (k) =>
    PRIVATE_DATA_PREFIXES.some(p => k === p || k.startsWith(`${p}_`))
  const matchesUx = (k) =>
    UX_FLAG_KEYS.includes(k) || UX_FLAG_PREFIXES.some(p => k.startsWith(p))

  try {
    for (const k of allKeys) {
      if (matchesPrivate(k) || matchesUx(k)) localStorage.removeItem(k)
    }
  } catch {}

  // 3. sessionStorage también
  try {
    for (const k of SESSION_KEYS) sessionStorage.removeItem(k)
  } catch {}
}

// Re-exports para tests.
export const __test__ = Object.freeze({
  PRIVATE_DATA_PREFIXES,
  SESSION_KEYS,
  UX_FLAG_KEYS,
  UX_FLAG_PREFIXES,
})
