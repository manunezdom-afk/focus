// Swipe horizontal entre vistas principales (Mi Día / Calendario / Tareas /
// Ajustes). Implementación quirúrgica con touchstart/touchmove/touchend —
// sin librerías de gestos para no añadir peso al bundle.
//
// Reglas para no chocar con scroll vertical ni inputs:
//   * Sólo activamos cuando el touch arranca en un área "pasiva" — si el
//     evento empezó en un input/textarea/button/link, ignoramos.
//   * Threshold horizontal: ≥ 60px de movimiento.
//   * El movimiento horizontal debe superar al vertical en ≥ 1.5×, así un
//     drag medio diagonal sigue siendo scroll.
//   * Tiempo máximo del gesto: 500ms — más que eso ya no es swipe sino
//     drag deliberado.
//   * Si el body tiene `keyboard-open` (iosKeyboard.js), desactivamos —
//     no queremos cambiar de vista mientras el usuario escribe.
//   * Si el documento tiene un overlay/modal/sheet abierto (detectado por
//     `[role="dialog"][aria-modal="true"]` visible), también desactivamos.

import { useEffect, useRef } from 'react'

const MIN_HORIZONTAL_PX = 60
const MIN_HORIZONTAL_RATIO = 1.5
const MAX_DURATION_MS = 500

const PASSIVE_AREA_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'P', 'SPAN', 'IMG', 'H1', 'H2', 'H3', 'H4', 'BODY'])

function isInteractiveTarget(node) {
  let el = node
  while (el && el !== document.body) {
    const tag = el.tagName
    if (!tag) break
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (tag === 'BUTTON' || tag === 'A') return true
    if (el.getAttribute && el.getAttribute('role') === 'button') return true
    // Containers con scroll horizontal propio (carruseles, listas semanales)
    // marcados con data-no-swipe para que el caller pueda excluirlos.
    if (el.dataset && el.dataset.noSwipe === 'true') return true
    if (!PASSIVE_AREA_TAGS.has(tag)) return false
    el = el.parentElement
  }
  return false
}

function hasOpenModal() {
  // Detección barata: si hay un dialog modal visible, no swipear. El bottomnav
  // sigue funcionando con tap normal.
  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  for (const d of dialogs) {
    if (d.offsetParent !== null) return true
  }
  return false
}

function isKeyboardOpen() {
  return document.body.classList.contains('keyboard-open')
}

/**
 * @param {Object} opts
 * @param {boolean} opts.enabled - si false, el listener no se monta.
 * @param {() => void} opts.onSwipeLeft - swipe izquierda (siguiente vista).
 * @param {() => void} opts.onSwipeRight - swipe derecha (vista anterior).
 * @param {React.RefObject<HTMLElement>} [opts.targetRef] - opcional, el
 *   contenedor en el que escuchar. Si no se pasa, escucha en window.
 */
export function useSwipeNavigation({ enabled, onSwipeLeft, onSwipeRight, targetRef }) {
  const stateRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const target = targetRef?.current || window

    function onTouchStart(e) {
      const t = e.touches?.[0]
      if (!t) return
      if (isInteractiveTarget(e.target)) {
        stateRef.current = null
        return
      }
      if (isKeyboardOpen() || hasOpenModal()) {
        stateRef.current = null
        return
      }
      stateRef.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        decided: false,  // 'h' = horizontal lock, 'v' = vertical lock, false = aún midiendo
      }
    }

    function onTouchMove(e) {
      const s = stateRef.current
      if (!s) return
      const t = e.touches?.[0]
      if (!t) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      // Decisión temprana de eje. Una vez decidido vertical, no volvemos
      // a evaluar — el resto del gesto es scroll, no swipe.
      if (!s.decided) {
        const ax = Math.abs(dx)
        const ay = Math.abs(dy)
        if (ax < 8 && ay < 8) return  // demasiado corto, esperar
        s.decided = ax > ay * MIN_HORIZONTAL_RATIO ? 'h' : 'v'
      }
      // Si es horizontal y nos pasamos del threshold, prevenimos scroll
      // del navegador para que la página no rebote por overscroll.
      if (s.decided === 'h' && Math.abs(dx) > 16 && e.cancelable) {
        e.preventDefault()
      }
    }

    function onTouchEnd(e) {
      const s = stateRef.current
      stateRef.current = null
      if (!s || s.decided !== 'h') return
      const t = e.changedTouches?.[0]
      if (!t) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      const dt = Date.now() - s.t
      if (dt > MAX_DURATION_MS) return
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax < MIN_HORIZONTAL_PX) return
      if (ax < ay * MIN_HORIZONTAL_RATIO) return
      // Re-chequear gates al soltar — el usuario pudo abrir un modal mid-gesto.
      if (isKeyboardOpen() || hasOpenModal()) return
      if (dx < 0) onSwipeLeft?.()
      else        onSwipeRight?.()
    }

    function onTouchCancel() {
      stateRef.current = null
    }

    // passive: false en touchmove para poder hacer preventDefault del overscroll
    // del browser. touchstart/end pueden ser passive.
    target.addEventListener('touchstart',  onTouchStart, { passive: true })
    target.addEventListener('touchmove',   onTouchMove,  { passive: false })
    target.addEventListener('touchend',    onTouchEnd,   { passive: true })
    target.addEventListener('touchcancel', onTouchCancel,{ passive: true })

    return () => {
      target.removeEventListener('touchstart',  onTouchStart)
      target.removeEventListener('touchmove',   onTouchMove)
      target.removeEventListener('touchend',    onTouchEnd)
      target.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, onSwipeLeft, onSwipeRight, targetRef])
}

// Re-export helpers para tests.
export const __test__ = Object.freeze({
  isInteractiveTarget,
  hasOpenModal,
  isKeyboardOpen,
  MIN_HORIZONTAL_PX,
  MIN_HORIZONTAL_RATIO,
  MAX_DURATION_MS,
})
