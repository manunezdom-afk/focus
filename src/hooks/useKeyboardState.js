// Estado del teclado mobile como hook React.
//
// La detección global ya la hace `setupIOSKeyboard()` desde main.jsx
// (clase `body.keyboard-open` para CSS). Este hook expone el mismo estado
// a componentes React que necesitan reaccionar (ej. NovaWidget puede
// scrollear su lista de mensajes al fondo cuando el teclado abre).
//
// Diseño:
//   * Usa MutationObserver sobre body.classList — no duplicamos listeners
//     del visualViewport ni del plugin Capacitor. Una sola fuente de verdad.
//   * Setea state UN SOLO BIT (open/closed). No exponemos altura porque la
//     decisión arquitectónica del proyecto es no setear --keyboard-height
//     (ver iosKeyboard.js para detalle).
//   * Es seguro en SSR (no toca window/document hasta useEffect).

import { useEffect, useState } from 'react'

export function useKeyboardOpen() {
  const [open, setOpen] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.body.classList.contains('keyboard-open')
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body

    function check() {
      setOpen(body.classList.contains('keyboard-open'))
    }

    // Sincroniza al mount por si la clase ya estaba aplicada.
    check()

    const observer = new MutationObserver(() => check())
    observer.observe(body, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return open
}
