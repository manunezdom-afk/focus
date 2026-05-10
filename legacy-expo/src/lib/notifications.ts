// Servicio de notificaciones locales — V1 segura.
//
// Por qué lazy require:
//   El binario instalado en este iPhone ahora mismo NO tiene la lib nativa
//   `expo-notifications` (la dep es nueva). Si importáramos a top-level,
//   el bundle JS tira "Module RNCExpoNotifications doesn't exist" al
//   primer require — crash en boot. En cambio, lazy require captura el
//   error y degrada: la UI muestra "no disponible · requiere rebuild" y
//   el resto de la app sigue funcionando. Cuando el usuario haga
//   `npm install && npx expo prebuild --clean && pod install` y rebuilde
//   desde Xcode, la lib aparece y este servicio se activa solo.
//
// V1 implementa solo NOTIFICACIONES LOCALES (programadas en el device).
// Push remoto/APNs requiere registrar device tokens contra un endpoint
// server + APNs key + certificate — fuera de scope V1.
//
// Hooks/components consumen solo a través de la API de este archivo —
// nunca llamen `require('expo-notifications')` directamente.

let _Notifications: any | null | undefined; // undefined = no chequeado, null = no disponible
let _notifLoadError: string | null = null;

function loadNotifications(): any | null {
  if (_Notifications !== undefined) return _Notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _Notifications = require('expo-notifications');
    return _Notifications;
  } catch (err: any) {
    _Notifications = null;
    _notifLoadError = err?.message ?? 'unknown';
    if (__DEV__) {
      console.warn('[notifications] expo-notifications no disponible:', _notifLoadError);
    }
    return null;
  }
}

export function isAvailable(): boolean {
  return loadNotifications() !== null;
}

export function getLoadError(): string | null {
  loadNotifications();
  return _notifLoadError;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const N = loadNotifications();
  if (!N) return 'unavailable';
  try {
    const { status } = await N.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestPermissions(): Promise<PermissionStatus> {
  const N = loadNotifications();
  if (!N) return 'unavailable';
  try {
    // iOS: Notifications.requestPermissionsAsync({ ios: { allowAlert, allowSound, allowBadge } })
    // Por defecto pide alert + sound + badge — match con UX típica.
    const { status } = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

// Programa una notificación local 5s adelante. Usado por el botón
// "Enviar notificación de prueba" en Ajustes — confirma al usuario que
// el flujo end-to-end funciona en su device sin necesidad de APNs.
export async function scheduleTestNotification(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const N = loadNotifications();
  if (!N) return { ok: false, reason: 'unavailable' };
  try {
    // Configurar el handler para que muestre el banner cuando la app
    // está en foreground (default es no mostrar). Configuración en
    // memoria — válida por la sesión.
    if (typeof N.setNotificationHandler === 'function') {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          // SDK 52+ replaces shouldShowAlert with banner+list flags.
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }

    await N.scheduleNotificationAsync({
      content: {
        title: 'Focus está listo',
        body: 'Esto es una notificación de prueba. Si la ves, todo está bien.',
        sound: 'default',
      },
      trigger: { seconds: 5, repeats: false },
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? 'schedule_failed' };
  }
}
