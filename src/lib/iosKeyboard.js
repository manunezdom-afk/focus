import { Capacitor } from '@capacitor/core'

// Suscribe a los eventos `keyboardWillShow` / `keyboardWillHide` del plugin
// `@capacitor/keyboard` y propaga el estado del teclado a CSS vía la
// clase `.keyboard-open` en <body>.
//
// IMPORTANTE: NO seteamos `--keyboard-height` cuando corremos en Capacitor.
// La config nativa usa `Keyboard.resize: "native"` (ver capacitor.config.json),
// que achica el WKWebView para dejar lugar al teclado. Si encima sumáramos
// `var(--keyboard-height)` al padding-bottom de las sheets (NovaWidget,
// QuickAddSheet, AddEventModal) estaríamos descontando el teclado dos veces:
// el WebView ya se movió hacia arriba y el contenido se empujaría otra vez
// la altura del teclado, dejando un agujero blanco enorme bajo el input y
// sensación de "salto" al abrir Nova. Mantener `--keyboard-height` en 0
// (su default) permite que la sheet aterrice flush con el borde del teclado
// y que sólo `safe-area-inset-bottom` aporte (correctamente 0 cuando el
// teclado tapa el home indicator).
//
// Sólo corre en iOS nativo. En web el plugin no se carga y la función
// retorna sin efecto.
export async function setupIOSKeyboard() {
  if (Capacitor.getPlatform() !== 'ios') return
  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open')
    })
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open')
    })
  } catch {
    // Plugin no disponible en este build — no-op silencioso.
  }
}
