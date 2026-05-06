import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Wrapper de Haptics que no rompe en web. iOS nativo lo soporta y se siente
// natural; Android soporta vibración menos refinada; web ignora silenciosamente.
//
// Por qué importa: el WKWebView de iOS no transmite el "feedback" físico de
// tappear que las apps nativas tienen. Sin Haptics, los taps en navegación,
// toggles, y confirmaciones se sienten "muertos" — el usuario no sabe si el
// tap llegó hasta que ve un cambio visual (que puede tardar 60-200ms). Con
// Haptics, el tap se confirma instantáneamente al cuerpo del usuario,
// haciendo que toda la app se sienta más responsiva, incluso si nada
// visualmente cambió aún.
//
// Política de uso (sutil, no invasivo):
//   tap()       — cambios de tab, toggles, taps de íconos. Light.
//   confirm()   — acción exitosa (crear evento, marcar tarea). Success.
//   warn()      — acción que puede revertirse (delete con undo). Warning.
//   error()     — error real (fallo de API, validación). Error.
//
// No usamos Heavy ni Vibrate — son demasiado intrusivos para una calendar app.

function isNative() {
  return Capacitor?.isNativePlatform?.() === true
}

export async function tap() {
  if (!isNative()) return
  try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
}

export async function confirm() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Success }) } catch {}
}

export async function warn() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Warning }) } catch {}
}

export async function error() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Error }) } catch {}
}

// Selección — para arrastres / scroll por chunks. Aún no usado en Focus
// pero queda exportado para cuando agreguemos drag de eventos.
export async function selectionTick() {
  if (!isNative()) return
  try { await Haptics.selectionChanged() } catch {}
}
