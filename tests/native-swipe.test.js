// Tests del hook src/lib/useNativeSwipe.js + src/lib/motion.js.
//
// Como Node no trae React DOM, sólo cubrimos las funciones puras:
// helpers de gates (input/modal/keyboard), constantes razonables,
// y el spring solver de motion.js (matemática 1D).

import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as swipe } from '../src/lib/useNativeSwipe.js'
import {
  stepSpring, isSpringSettled,
  EASE_IOS, DURATION, SPRING, prefersReducedMotion, safeTransition,
} from '../src/lib/motion.js'

const {
  isInteractiveTarget, hasOpenModal, isKeyboardOpen,
  THRESHOLD_PX_RATIO, THRESHOLD_VEL_PX_PER_MS,
  RUBBER_BAND_RATIO, AXIS_DECIDE_PX, AXIS_LOCK_RATIO, SYSTEM_EDGE_PX,
} = swipe

// Polyfill mínimo para document/HTMLElement.
class FakeNode {
  constructor(tag, opts = {}) {
    this.tagName = tag
    this.dataset = opts.dataset || {}
    this.parentElement = opts.parent || null
    this.attrs = opts.attrs || {}
    this.offsetParent = opts.visible !== false ? {} : null
  }
  getAttribute(name) { return this.attrs[name] ?? null }
}

function setUpDom({ keyboardOpen = false, dialogs = [] } = {}) {
  globalThis.document = {
    body: { classList: { contains: (c) => keyboardOpen && c === 'keyboard-open' } },
    querySelectorAll: () => dialogs,
  }
}
function tearDownDom() { delete globalThis.document }

// ─── isInteractiveTarget ────────────────────────────────────────────────────

test('isInteractiveTarget detecta input/textarea/select', () => {
  setUpDom()
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(isInteractiveTarget(new FakeNode(tag)), true)
  }
  tearDownDom()
})

test('isInteractiveTarget detecta button/anchor/role-button', () => {
  setUpDom()
  assert.equal(isInteractiveTarget(new FakeNode('BUTTON')), true)
  assert.equal(isInteractiveTarget(new FakeNode('A')), true)
  assert.equal(isInteractiveTarget(new FakeNode('DIV', { attrs: { role: 'button' } })), true)
  tearDownDom()
})

test('isInteractiveTarget respeta data-no-swipe', () => {
  setUpDom()
  assert.equal(isInteractiveTarget(new FakeNode('DIV', { dataset: { noSwipe: 'true' } })), true)
  tearDownDom()
})

test('isInteractiveTarget false en áreas pasivas', () => {
  setUpDom()
  for (const tag of ['DIV', 'SECTION', 'P', 'SPAN', 'UL', 'LI']) {
    assert.equal(isInteractiveTarget(new FakeNode(tag)), false)
  }
  tearDownDom()
})

// ─── hasOpenModal / isKeyboardOpen ──────────────────────────────────────────

test('hasOpenModal y isKeyboardOpen', () => {
  setUpDom({ dialogs: [], keyboardOpen: false })
  assert.equal(hasOpenModal(), false)
  assert.equal(isKeyboardOpen(), false)
  tearDownDom()

  setUpDom({ dialogs: [new FakeNode('DIV', { visible: true })], keyboardOpen: true })
  assert.equal(hasOpenModal(), true)
  assert.equal(isKeyboardOpen(), true)
  tearDownDom()
})

// ─── Constantes razonables ──────────────────────────────────────────────────

test('thresholds del swipe son iOS-like', () => {
  // 30% del ancho — para iPhone 15 (390px) son ~117px, que es donde Apple
  // tiene el threshold de page-flip en Safari.
  assert.ok(THRESHOLD_PX_RATIO >= 0.20 && THRESHOLD_PX_RATIO <= 0.40)
  // 0.55 px/ms = 550 px/seg — Apple usa ~500-600 px/seg para flick.
  assert.ok(THRESHOLD_VEL_PX_PER_MS >= 0.4 && THRESHOLD_VEL_PX_PER_MS <= 0.8)
  // Rubber band entre 0.4-0.6 — clásico iOS.
  assert.ok(RUBBER_BAND_RATIO >= 0.3 && RUBBER_BAND_RATIO <= 0.6)
  // Axis lock no debe ser ni demasiado estricto ni demasiado laxo.
  assert.ok(AXIS_LOCK_RATIO >= 1.2 && AXIS_LOCK_RATIO <= 2.0)
  assert.ok(AXIS_DECIDE_PX >= 4 && AXIS_DECIDE_PX <= 16)
  // System edge — Apple usa 20px aprox para edge swipe back.
  assert.equal(SYSTEM_EDGE_PX, 20)
})

// ─── motion.js exports ──────────────────────────────────────────────────────

test('motion.js expone curvas y duraciones consistentes', () => {
  assert.ok(Array.isArray(EASE_IOS) && EASE_IOS.length === 4)
  assert.ok(DURATION.fast > 0 && DURATION.fast < DURATION.page)
  assert.ok(DURATION.page < DURATION.sheet)
  assert.ok(SPRING.page.stiffness > 0 && SPRING.page.damping > 0)
})

test('safeTransition cae a fallback con prefers-reduced-motion', () => {
  // En Node sin matchMedia, prefersReducedMotion devuelve false → spring normal.
  const t = safeTransition(SPRING.page)
  assert.equal(t, SPRING.page)
})

test('prefersReducedMotion no rompe en Node sin matchMedia', () => {
  // matchMedia no existe en Node — debe devolver false sin lanzar.
  assert.doesNotThrow(() => prefersReducedMotion())
  assert.equal(prefersReducedMotion(), false)
})

// ─── Spring solver ──────────────────────────────────────────────────────────

test('stepSpring converge al target en ~0.5-1.5s', () => {
  // Estado inicial: 200px desplazado, sin velocidad. Objetivo: 0.
  let state = { x: 200, v: 0 }
  const target = 0
  let time = 0
  const dt = 1 / 60
  let iterations = 0
  while (!isSpringSettled(state, target) && time < 3) {
    state = stepSpring(state, target, dt)
    time += dt
    iterations += 1
  }
  // Debe haber settled dentro de un rango razonable.
  assert.ok(time < 2, `spring tardó demasiado: ${time}s`)
  assert.ok(iterations > 10, 'spring no debería settled en 1 frame')
  assert.ok(Math.abs(state.x) < 0.01)
})

test('stepSpring respeta velocidad inicial (flick effect)', () => {
  // Si suelto con velocidad alta hacia el target, debería pasar más rápido.
  let stateSlow = { x: 100, v: 0 }
  let stateFast = { x: 100, v: -500 }  // velocidad apuntando al target
  let timeSlow = 0, timeFast = 0
  const dt = 1 / 60
  while (!isSpringSettled(stateSlow, 0) && timeSlow < 3) {
    stateSlow = stepSpring(stateSlow, 0, dt)
    timeSlow += dt
  }
  while (!isSpringSettled(stateFast, 0) && timeFast < 3) {
    stateFast = stepSpring(stateFast, 0, dt)
    timeFast += dt
  }
  assert.ok(timeFast <= timeSlow,
    `con velocidad inicial debería settled más rápido: slow=${timeSlow.toFixed(3)} fast=${timeFast.toFixed(3)}`)
})

test('isSpringSettled requiere posición Y velocidad cerca de cero', () => {
  // Posición OK pero todavía moviéndose → no settled.
  assert.equal(isSpringSettled({ x: 0, v: 1 }, 0), false)
  // Posición lejos pero velocidad 0 (instantáneo) → no settled.
  assert.equal(isSpringSettled({ x: 50, v: 0 }, 0), false)
  // Ambos ~0 → settled.
  assert.equal(isSpringSettled({ x: 0.0001, v: 0.0001 }, 0), true)
})
