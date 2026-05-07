import { Capacitor } from '@capacitor/core'

// Detecta el estado del teclado en mobile y propaga a CSS vía la clase
// `.keyboard-open` en <body>. NO seteamos `--keyboard-height` — explicación
// abajo.
//
// Hay dos rutas según el runtime:
//
// 1) Capacitor iOS nativo: usamos los eventos `keyboardWillShow` /
//    `keyboardWillHide` del plugin `@capacitor/keyboard`. Esto es preciso
//    y respeta la animación del teclado del sistema.
//
//    IMPORTANTE: NO seteamos `--keyboard-height` cuando corremos en
//    Capacitor. La config nativa usa `Keyboard.resize: "native"` (ver
//    capacitor.config.json), que achica el WKWebView para dejar lugar al
//    teclado. Si encima sumáramos `var(--keyboard-height)` al padding-bottom
//    de las sheets (NovaWidget, QuickAddSheet, AddEventModal) estaríamos
//    descontando el teclado dos veces: el WebView ya se movió hacia arriba
//    y el contenido se empujaría otra vez la altura del teclado, dejando un
//    agujero blanco enorme bajo el input y sensación de "salto" al abrir
//    Nova. Mantener `--keyboard-height` en 0 (su default) permite que la
//    sheet aterrice flush con el borde del teclado y que sólo
//    safe-area-inset-bottom aporte (correctamente 0 cuando el teclado tapa
//    el home indicator).
//
// 2) PWA Safari iOS / desktop browser / Android Chrome: el plugin de
//    Capacitor no aplica. Usamos `window.visualViewport.resize` para
//    detectar la diferencia entre `window.innerHeight` y
//    `visualViewport.height`. Esa diferencia es la altura del teclado
//    (con margen de error por chrome dinámico de Safari). Si el delta
//    supera 150px asumimos teclado y flippeamos `.keyboard-open`. Esto
//    permite que reglas CSS (esconder BottomNavBar mientras se escribe)
//    funcionen también en la versión web.

const KB_HEIGHT_THRESHOLD_PX = 150

function setOpen(open) {
  if (open) document.body.classList.add('keyboard-open')
  else      document.body.classList.remove('keyboard-open')
}

export async function setupIOSKeyboard() {
  // Branch 1: Capacitor iOS — plugin oficial.
  if (Capacitor.getPlatform() === 'ios') {
    try {
      const { Keyboard } = await import('@capacitor/keyboard')
      Keyboard.addListener('keyboardWillShow', () => setOpen(true))
      Keyboard.addListener('keyboardWillHide', () => setOpen(false))
      return
    } catch {
      // Plugin no disponible en este build — caemos al branch 2.
    }
  }

  // Branch 2: visualViewport (PWA Safari, browser, Android Chrome).
  if (typeof window === 'undefined' || !window.visualViewport) return

  const vv = window.visualViewport
  let lastOpen = false

  function check() {
    const innerH = window.innerHeight || 0
    const vvH    = vv.height || innerH
    const delta  = innerH - vvH
    const open   = delta > KB_HEIGHT_THRESHOLD_PX
    if (open !== lastOpen) {
      lastOpen = open
      setOpen(open)
    }
  }

  vv.addEventListener('resize', check)
  vv.addEventListener('scroll', check)
  check()
}
