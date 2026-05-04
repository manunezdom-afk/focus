import { Capacitor } from '@capacitor/core'

// Suscribe a los eventos `keyboardWillShow` / `keyboardWillHide` del plugin
// `@capacitor/keyboard` y propaga la altura del teclado a CSS:
//   1. Setea --keyboard-height en <body> con la altura del teclado en px.
//   2. Toggle clase .keyboard-open en <body> para que las hojas inferiores
//      (QuickAddSheet, AddEventModal, NovaWidget) puedan responder con un
//      padding-bottom animado y matchear la curva nativa de iOS.
//
// Sólo corre en iOS nativo. En web el plugin no se carga y la función
// retorna sin efecto.
export async function setupIOSKeyboard() {
  if (Capacitor.getPlatform() !== 'ios') return
  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    Keyboard.addListener('keyboardWillShow', (info) => {
      const h = info?.keyboardHeight ?? 0
      document.body.style.setProperty('--keyboard-height', `${h}px`)
      document.body.classList.add('keyboard-open')
    })
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.setProperty('--keyboard-height', '0px')
      document.body.classList.remove('keyboard-open')
    })
  } catch {
    // Plugin no disponible en este build — no-op silencioso.
  }
}
