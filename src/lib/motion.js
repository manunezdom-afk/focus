// Lenguaje de movimiento centralizado para Focus.
//
// Por qué un archivo único: animaciones inconsistentes entre componentes son
// la causa #1 de que una app web "se sienta web". Apple usa muy pocas curvas
// y duraciones (UIKit y SwiftUI tienen ~3 spring presets que cubren todo).
// Aquí hacemos lo mismo.
//
// Reglas:
//   * Para gestos interactivos (drag, swipe) → usar SPRING (energía elástica
//     proporcional a velocidad).
//   * Para transiciones discretas (modal abre/cierra, tab change con tap) →
//     usar EASE corto (160-220ms).
//   * Nunca animar height/width — siempre transform/opacity.
//   * Respetar `prefers-reduced-motion`.

// ─── Easing curves ──────────────────────────────────────────────────────────

// Cubic-bezier de iOS standard (UIView animateWithDuration default).
// Acelera al inicio, desacelera al final. Naturaliza casi cualquier
// transición discreta.
export const EASE_IOS = [0.32, 0.72, 0, 1]

// Apple keyboard show/hide curve. Cuando coordinamos UI con el teclado,
// usar ESTA curva hace que el contenido se sienta atado al keyboard.
export const EASE_KEYBOARD = [0.32, 0.72, 0, 1]

// Output de drag al soltar (cuando NO completa la acción y vuelve al inicio).
// Empieza rápido, termina suave. Sensación de "rubber band" iOS.
export const EASE_SNAP_BACK = [0.22, 1, 0.36, 1]

// Decay de movimiento a cero — usar cuando un elemento entra en reposo.
export const EASE_DECEL = [0.16, 1, 0.3, 1]

// ─── Durations (ms) ─────────────────────────────────────────────────────────

export const DURATION = Object.freeze({
  // Feedback inmediato (active state, ripple).
  instant: 80,
  // Transición discreta corta (botón pressed, focus change).
  fast: 160,
  // Cambio de pantalla con tap (tab → tab).
  page: 220,
  // Modal/sheet abre/cierra.
  sheet: 280,
  // Snap-back de un drag fallido — más largo para que el rebote se sienta.
  snapBack: 300,
  // Keyboard iOS estándar (Apple no expone exactamente, ~250ms).
  keyboard: 250,
})

// ─── Spring presets (framer-motion compatible) ──────────────────────────────
//
// stiffness/damping/mass son los que UIKit usa por dentro para sus springs
// de uso común. Calibrados a mano para sentirse iOS-like en WKWebView, no
// como spring genérico de la web.

export const SPRING = Object.freeze({
  // Tab change interactivo — debe asentar rápido sin overshoot perceptible.
  page: { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 },
  // Snap-back de drag — un poco más blando para que el rebote se note.
  snap: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  // Bottom nav apareciendo/desapareciendo. Más rígido — debe quedar firme.
  panel: { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 },
  // Layout transitions (badge, indicador) — muy ágil, sin overshoot.
  ui: { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 },
})

// ─── Reduced motion helper ──────────────────────────────────────────────────

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Atajo: devuelve `safeTransition` que cambia spring por opacity-fade plano
// si el usuario pidió reduced motion.
export function safeTransition(transition, fallback = { duration: DURATION.fast / 1000 }) {
  return prefersReducedMotion() ? fallback : transition
}

// ─── Spring solver simple — para gestos manuales con rAF ────────────────────
//
// Cuando hacemos drag con transform manual (no framer-motion), el snap-back
// y el commit-animation también deben usar la misma física. createSpring()
// devuelve un solver puro: dado el estado actual y el target, avanza un
// frame y devuelve el nuevo estado. Cero deps externas.

const DEFAULT_SPRING = { stiffness: 380, damping: 36, mass: 0.9 }
const PRECISION = 0.001  // px

/**
 * Step de un spring crítico-amortiguado para 1 dimensión. Sin imports.
 *
 * Uso típico:
 *   let state = { x: 200, v: 0 }   // 200px desplazado, sin velocidad
 *   const target = 0               // queremos volver al origen
 *   while (!isSpringSettled(state, target)) {
 *     state = stepSpring(state, target, dt, PRESET)
 *     applyTransform(state.x)
 *   }
 *
 * dt en segundos (ej. 1/60 para 60fps, o tiempo real entre frames).
 */
export function stepSpring(state, target, dt, preset = DEFAULT_SPRING) {
  const { stiffness, damping, mass } = preset
  const dx = state.x - target
  const accel = (-stiffness * dx - damping * state.v) / mass
  const v = state.v + accel * dt
  const x = state.x + v * dt
  return { x, v }
}

export function isSpringSettled(state, target) {
  return Math.abs(state.x - target) < PRECISION && Math.abs(state.v) < PRECISION
}

export const __test__ = Object.freeze({ DEFAULT_SPRING, PRECISION })
