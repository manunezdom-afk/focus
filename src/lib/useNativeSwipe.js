// Swipe interactivo entre vistas que SIGUE EL DEDO en tiempo real.
//
// Diseño:
//   * Durante el drag, aplicamos transform translateX directamente al ref
//     del wrapper de la vista activa, vía requestAnimationFrame. NO usamos
//     setState — eso causaría 60+ re-renders/segundo y atorraría la app.
//   * Al soltar:
//       (a) si Δx > THRESHOLD_PX o velocidad > THRESHOLD_VEL → COMMIT:
//           animamos el wrapper hasta -100% width con un spring crítico,
//           disparamos onCommit() (que cambia la vista). El nuevo wrapper
//           aparece ya en su posición con la animación normal de framer-motion.
//       (b) si no → SNAP-BACK: animamos el wrapper de vuelta a 0 con spring,
//           NO llamamos onCommit.
//   * Resistencia (rubber band) en los bordes: si la vista actual no tiene
//     "siguiente" (ej. en Ajustes deslizando aún más a la izquierda), el
//     drag responde con la mitad del movimiento (sensación iOS típica).
//
// Reglas que protegen scroll/inputs/modales (heredadas del hook anterior):
//   * Touch que arranca en input/textarea/button/anchor/role=button
//     o data-no-swipe → ignorado.
//   * `body.keyboard-open` → ignorado.
//   * `[role=dialog][aria-modal=true]` visible → ignorado.
//   * Decisión de eje temprana (≥8px): si decide vertical, todo el resto
//     del gesto es scroll y no tocamos transform.
//   * Edge-swipe del sistema iOS (primeros 20px del borde izquierdo) →
//     ignoramos para no chocar con back nativo.

import { useEffect, useRef, useCallback } from 'react'
import { stepSpring, isSpringSettled, SPRING } from './motion.js'

const THRESHOLD_PX_RATIO = 0.30        // 30% del ancho de la vista
const THRESHOLD_VEL_PX_PER_MS = 0.55   // 550 px/seg
const RUBBER_BAND_RATIO = 0.45         // 0.45× cuando no hay tab en esa dirección
const AXIS_DECIDE_PX = 8
const AXIS_LOCK_RATIO = 1.5
const SYSTEM_EDGE_PX = 20              // ignorar primeros 20px del borde izquierdo

const PASSIVE_AREA_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'P', 'SPAN', 'IMG', 'H1', 'H2', 'H3', 'H4', 'BODY', 'UL', 'OL', 'LI'])

function isInteractiveTarget(node) {
  let el = node
  while (el && el !== document.body) {
    const tag = el.tagName
    if (!tag) break
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (tag === 'BUTTON' || tag === 'A') return true
    if (el.getAttribute && el.getAttribute('role') === 'button') return true
    if (el.dataset && el.dataset.noSwipe === 'true') return true
    if (!PASSIVE_AREA_TAGS.has(tag)) return false
    el = el.parentElement
  }
  return false
}

function hasOpenModal() {
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
 * @param {boolean}             opts.enabled
 * @param {React.RefObject}     opts.containerRef - el wrapper que vamos a translatear.
 * @param {() => boolean}       [opts.canGoLeft]  - si false, drag a la izquierda con rubber band.
 * @param {() => boolean}       [opts.canGoRight] - idem.
 * @param {() => void}          opts.onCommitLeft  - swipe completado a izquierda (siguiente vista).
 * @param {() => void}          opts.onCommitRight - swipe completado a derecha (vista anterior).
 * @param {() => void}          [opts.onHaptic]    - se llama una vez al pasar el threshold (feedback al dedo).
 */
export function useNativeSwipe({
  enabled,
  containerRef,
  canGoLeft = () => true,
  canGoRight = () => true,
  onCommitLeft,
  onCommitRight,
  onHaptic,
}) {
  const stateRef = useRef(null)         // datos del gesto actual
  const rafRef = useRef(0)              // id de rAF para cancelar
  const hapticFiredRef = useRef(false)  // dispara haptic una sola vez por gesto

  const applyTransform = useCallback((x) => {
    const el = containerRef?.current
    if (!el) return
    el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`
  }, [containerRef])

  // Cancela cualquier animación en curso. Devuelve la posición actual leída
  // del transform por si necesitamos arrancar un nuevo gesto.
  const cancelRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  // Anima el wrapper de `from` a `to` con spring crítico y al terminar
  // dispara onDone(). Usa rAF + dt real para no asumir 60fps.
  const animateTo = useCallback((from, to, velocity, onDone, preset = SPRING.page) => {
    cancelRaf()
    let state = { x: from, v: velocity || 0 }
    let lastT = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.064, (now - lastT) / 1000)  // cap a 64ms para evitar saltos
      lastT = now
      // El spring solver de motion.js usa stiffness/damping/mass crudo.
      state = stepSpring(state, to, dt, {
        stiffness: preset.stiffness,
        damping: preset.damping,
        mass: preset.mass,
      })
      applyTransform(state.x)
      if (isSpringSettled(state, to)) {
        applyTransform(to === 0 ? 0 : to)
        rafRef.current = 0
        onDone?.()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [applyTransform, cancelRaf])

  useEffect(() => {
    if (!enabled) return
    cancelRaf()

    function onTouchStart(e) {
      const t = e.touches?.[0]
      if (!t) return
      if (isInteractiveTarget(e.target)) { stateRef.current = null; return }
      if (isKeyboardOpen() || hasOpenModal()) { stateRef.current = null; return }
      // Edge-swipe del sistema iOS (back gesture nativo) — no chocar.
      if (t.clientX < SYSTEM_EDGE_PX) { stateRef.current = null; return }

      cancelRaf()
      hapticFiredRef.current = false
      const width = containerRef?.current?.offsetWidth || window.innerWidth || 360
      stateRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startT: performance.now(),
        lastX: t.clientX,
        lastT: performance.now(),
        velocity: 0,
        decided: null,         // 'h' | 'v' | null
        currentX: 0,           // posición actual del transform
        width,
      }
    }

    function onTouchMove(e) {
      const s = stateRef.current
      if (!s) return
      const t = e.touches?.[0]
      if (!t) return

      const dx = t.clientX - s.startX
      const dy = t.clientY - s.startY

      if (!s.decided) {
        const ax = Math.abs(dx)
        const ay = Math.abs(dy)
        if (ax < AXIS_DECIDE_PX && ay < AXIS_DECIDE_PX) return
        s.decided = ax > ay * AXIS_LOCK_RATIO ? 'h' : 'v'
        if (s.decided === 'v') {
          // Dropeamos el gesto para no interferir con scroll.
          stateRef.current = null
          return
        }
      }

      if (s.decided !== 'h') return

      // Velocity instantánea (px/ms) — usamos para decidir commit al release.
      const now = performance.now()
      const dtFrame = now - s.lastT
      if (dtFrame > 0) {
        const dxFrame = t.clientX - s.lastX
        // EMA simple para suavizar la lectura ruidosa de los últimos ms.
        s.velocity = 0.7 * (dxFrame / dtFrame) + 0.3 * s.velocity
      }
      s.lastX = t.clientX
      s.lastT = now

      // Resistencia rubber-band cuando no hay vista en esa dirección.
      let effectiveDx = dx
      if (dx < 0 && !canGoLeft())  effectiveDx = dx * RUBBER_BAND_RATIO
      if (dx > 0 && !canGoRight()) effectiveDx = dx * RUBBER_BAND_RATIO

      s.currentX = effectiveDx

      // Aplicamos transform sin pasar por React. Cero re-renders.
      applyTransform(effectiveDx)

      // Haptic una sola vez al cruzar el threshold de distancia.
      if (!hapticFiredRef.current) {
        const threshold = s.width * THRESHOLD_PX_RATIO
        if (Math.abs(effectiveDx) >= threshold) {
          // Solo si ese sentido es válido (evita haptic si solo es rubber band).
          const valid = (effectiveDx < 0 && canGoLeft()) || (effectiveDx > 0 && canGoRight())
          if (valid) {
            hapticFiredRef.current = true
            onHaptic?.()
          }
        }
      }

      // Prevenimos scroll del browser solo después de decidir horizontal.
      if (e.cancelable) e.preventDefault()
    }

    function onTouchEnd() {
      const s = stateRef.current
      stateRef.current = null
      if (!s || s.decided !== 'h') return

      const threshold = s.width * THRESHOLD_PX_RATIO
      const dx = s.currentX
      const v = s.velocity * 1000  // px/seg
      const passedDistance = Math.abs(dx) >= threshold
      const passedVelocity = Math.abs(v) >= THRESHOLD_VEL_PX_PER_MS * 1000

      let commit = false
      if (passedDistance || passedVelocity) {
        if (dx < 0 && canGoLeft())  commit = 'left'
        if (dx > 0 && canGoRight()) commit = 'right'
      }

      // Re-chequear gates al soltar (un modal pudo abrirse mid-gesto).
      if (commit && (isKeyboardOpen() || hasOpenModal())) commit = false

      if (commit) {
        // Animamos hasta el borde y al terminar invocamos el navigate.
        const targetX = commit === 'left' ? -s.width : s.width
        animateTo(dx, targetX, v / 1000, () => {
          // Reseteamos transform ANTES del navigate para que la vista
          // entrante aparezca sin offset residual.
          applyTransform(0)
          if (commit === 'left')  onCommitLeft?.()
          if (commit === 'right') onCommitRight?.()
        }, SPRING.page)
      } else {
        // Snap-back con un spring suave.
        animateTo(dx, 0, v / 1000, null, SPRING.snap)
      }
    }

    function onTouchCancel() {
      const s = stateRef.current
      stateRef.current = null
      if (!s) return
      // Volvemos a 0 con un spring rápido.
      if (s.decided === 'h' && s.currentX !== 0) {
        animateTo(s.currentX, 0, 0, null, SPRING.snap)
      }
    }

    document.addEventListener('touchstart',  onTouchStart, { passive: true })
    document.addEventListener('touchmove',   onTouchMove,  { passive: false })
    document.addEventListener('touchend',    onTouchEnd,   { passive: true })
    document.addEventListener('touchcancel', onTouchCancel,{ passive: true })

    return () => {
      cancelRaf()
      applyTransform(0)
      document.removeEventListener('touchstart',  onTouchStart)
      document.removeEventListener('touchmove',   onTouchMove)
      document.removeEventListener('touchend',    onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, canGoLeft, canGoRight, onCommitLeft, onCommitRight, onHaptic, animateTo, applyTransform, cancelRaf, containerRef])
}

export const __test__ = Object.freeze({
  isInteractiveTarget, hasOpenModal, isKeyboardOpen,
  THRESHOLD_PX_RATIO, THRESHOLD_VEL_PX_PER_MS,
  RUBBER_BAND_RATIO, AXIS_DECIDE_PX, AXIS_LOCK_RATIO, SYSTEM_EDGE_PX,
})
