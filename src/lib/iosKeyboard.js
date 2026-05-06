import { Capacitor } from '@capacitor/core'

function isIOSWebKit() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

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
// Corre en iOS nativo y en Safari/PWA iOS. En desktop/Android retorna sin
// efecto para no tocar layouts que ya funcionan con su viewport normal.
export async function setupIOSKeyboard() {
  const nativeIOS = Capacitor.getPlatform() === 'ios'
  const iosWeb = isIOSWebKit()
  if (!nativeIOS && !iosWeb) return

  const root = document.documentElement
  const body = document.body
  root.classList.add('is-ios')
  let baselineHeight = window.innerHeight || root.clientHeight || 0

  function updateVisualViewportVars() {
    const vv = window.visualViewport
    const visualHeight = Math.round(vv?.height || window.innerHeight || baselineHeight)
    const offsetTop = Math.round(vv?.offsetTop || 0)
    root.style.setProperty('--focus-visual-viewport-height', `${visualHeight}px`)

    // En Capacitor con Keyboard.resize=native el WebView ya se achica. Por eso
    // nunca escribimos --keyboard-height allí: sólo marcamos estado. En Safari
    // PWA/web sí necesitamos el overlap real para sheets que no reciben resize
    // nativo del contenedor.
    const overlap = Math.max(0, Math.round(baselineHeight - visualHeight - offsetTop))
    if (!nativeIOS) {
      body.style.setProperty('--keyboard-height', `${overlap}px`)
      body.classList.toggle('keyboard-open', overlap > 80)
    }
  }

  updateVisualViewportVars()
  window.visualViewport?.addEventListener('resize', updateVisualViewportVars)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportVars)
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      baselineHeight = window.innerHeight || root.clientHeight || baselineHeight
      updateVisualViewportVars()
    }, 250)
  })

  if (!nativeIOS) return
  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open')
      updateVisualViewportVars()
    })
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open')
      document.body.style.setProperty('--keyboard-height', '0px')
      updateVisualViewportVars()
    })
  } catch {
    // Plugin no disponible en este build — no-op silencioso.
  }
}
