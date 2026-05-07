// Tests del hook src/lib/useSwipeNavigation.js — solo de las funciones
// puras helpers; el hook real necesita un renderer de React que el repo
// no tiene instalado, así que cubrimos la lógica testeable
// (gates de teclado/modal, detección de target interactivo).

import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ } from '../src/lib/useSwipeNavigation.js'

const { isInteractiveTarget, hasOpenModal, isKeyboardOpen,
        MIN_HORIZONTAL_PX, MIN_HORIZONTAL_RATIO, MAX_DURATION_MS } = __test__

// Mínimo polyfill: Node no trae document/HTMLElement.
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

function tearDownDom() {
  delete globalThis.document
}

// ─── isInteractiveTarget ────────────────────────────────────────────────────

test('isInteractiveTarget reconoce input/textarea/select', () => {
  setUpDom()
  assert.equal(isInteractiveTarget(new FakeNode('INPUT')), true)
  assert.equal(isInteractiveTarget(new FakeNode('TEXTAREA')), true)
  assert.equal(isInteractiveTarget(new FakeNode('SELECT')), true)
  tearDownDom()
})

test('isInteractiveTarget reconoce button/anchor', () => {
  setUpDom()
  assert.equal(isInteractiveTarget(new FakeNode('BUTTON')), true)
  assert.equal(isInteractiveTarget(new FakeNode('A')), true)
  tearDownDom()
})

test('isInteractiveTarget respeta role="button"', () => {
  setUpDom()
  const btnLike = new FakeNode('DIV', { attrs: { role: 'button' } })
  assert.equal(isInteractiveTarget(btnLike), true)
  tearDownDom()
})

test('isInteractiveTarget respeta data-no-swipe', () => {
  setUpDom()
  const carousel = new FakeNode('DIV', { dataset: { noSwipe: 'true' } })
  assert.equal(isInteractiveTarget(carousel), true)
  tearDownDom()
})

test('isInteractiveTarget devuelve false para áreas pasivas', () => {
  setUpDom()
  assert.equal(isInteractiveTarget(new FakeNode('DIV')), false)
  assert.equal(isInteractiveTarget(new FakeNode('SECTION')), false)
  assert.equal(isInteractiveTarget(new FakeNode('P')), false)
  tearDownDom()
})

test('isInteractiveTarget bubblea a parents — input dentro de div es interactivo', () => {
  setUpDom()
  const parentInput = new FakeNode('INPUT')
  const child = new FakeNode('SPAN', { parent: parentInput })
  assert.equal(isInteractiveTarget(child), true)
  tearDownDom()
})

// ─── hasOpenModal ───────────────────────────────────────────────────────────

test('hasOpenModal devuelve false sin dialogs', () => {
  setUpDom({ dialogs: [] })
  assert.equal(hasOpenModal(), false)
  tearDownDom()
})

test('hasOpenModal devuelve true con dialog visible', () => {
  setUpDom({ dialogs: [new FakeNode('DIV', { visible: true })] })
  assert.equal(hasOpenModal(), true)
  tearDownDom()
})

test('hasOpenModal devuelve false con dialog oculto (offsetParent null)', () => {
  setUpDom({ dialogs: [new FakeNode('DIV', { visible: false })] })
  assert.equal(hasOpenModal(), false)
  tearDownDom()
})

// ─── isKeyboardOpen ─────────────────────────────────────────────────────────

test('isKeyboardOpen lee body.classList.contains("keyboard-open")', () => {
  setUpDom({ keyboardOpen: true })
  assert.equal(isKeyboardOpen(), true)
  tearDownDom()

  setUpDom({ keyboardOpen: false })
  assert.equal(isKeyboardOpen(), false)
  tearDownDom()
})

// ─── Constantes ─────────────────────────────────────────────────────────────

test('Threshold values son razonables para mobile', () => {
  // 60px ~ 16-20% del ancho de iPhone, suficiente para distinguir intención.
  assert.ok(MIN_HORIZONTAL_PX >= 40 && MIN_HORIZONTAL_PX <= 80)
  // Ratio 1.5 evita falsos positivos al hacer scroll diagonal.
  assert.ok(MIN_HORIZONTAL_RATIO >= 1.2 && MIN_HORIZONTAL_RATIO <= 2.0)
  // 500ms cubre el rango natural de un swipe humano (200-400ms típico).
  assert.ok(MAX_DURATION_MS >= 300 && MAX_DURATION_MS <= 800)
})
