// Tests unitarios de `detectComplexInput` (api/focus-assistant.js).
//
// Bug origen (beta-12 TestFlight): la frase
//   "mañana tengo doctor a las 5 y recuérdame llevar los exámenes"
// debía rutearse directamente a Sonnet para emitir 2 acciones
// (evento + recordatorio), pero `detectComplexInput` devolvía false:
//   * `strongHints` no contenía " y recuérdame " ni variantes
//   * timeHits=1 (solo "a las 5"), no llegaba a 2
//   * texto 62 chars < 70 (umbral de coma+tiempo)
// Resultado: la frase iba a Haiku, que colapsaba todo en 1 add_event con
// reminderNotes pegados → el usuario no veía recordatorio separado.
//
// Estos tests bloquean la regresión de esos casos y validan los demás
// patrones críticos del QA matrix.

import assert from 'node:assert/strict'
import test from 'node:test'

import { __detectComplexInput as detect } from '../api/focus-assistant.js'

// ─── A) Evento + recordatorio (caso crítico beta-12) ────────────────────────

test('detecta " y recuérdame " como multi-acción', () => {
  assert.equal(detect('mañana tengo doctor a las 5 y recuérdame llevar los exámenes'), true)
})

test('detecta " y acuérdame " como multi-acción', () => {
  assert.equal(detect('mañana tengo psiquiatra a las 12 y acuérdame contarle lo del remedio'), true)
})

test('detecta " y avísame " como multi-acción', () => {
  assert.equal(detect('tengo reunión con la universidad hoy a las 4 y avísame salir 30 minutos antes'), true)
})

test('detecta variante sin tilde " y recuerdame "', () => {
  assert.equal(detect('mañana tengo doctor a las 5 y recuerdame llevar los examenes'), true)
})

test('detecta variante voseo-chilena " y acordame "', () => {
  assert.equal(detect('mañana tengo dentista a las 3 y acordame llevar la receta'), true)
})

test('detecta evento + recordatorio SIN conector "y" — "tengo X a las Y acuérdame Z"', () => {
  // Frase sin "y" entre evento y recordatorio. El detector de 1b debe
  // disparar porque tiene verbo de evento ("tengo") + trigger ("acuérdame")
  // en posiciones lejanas (>12 chars).
  assert.equal(detect('tengo clase a las 10:30 acuérdame avisar al profe'), true)
})

test('detecta "y no te olvides"', () => {
  assert.equal(detect('mañana voy a la oficina y no te olvides de mandar el reporte'), true)
})

// ─── B) Dos eventos con horas (clásico del system prompt) ───────────────────

test('detecta dos horas en una frase', () => {
  assert.equal(detect('hoy a las 5 gimnasio y a las 8 estudiar'), true)
})

test('detecta tres horas (timeHits ≥ 2)', () => {
  assert.equal(detect('mañana a las 9 clases, a las 12 reunión y a las 7 gimnasio'), true)
})

test('detecta "después" como conector multi', () => {
  assert.equal(detect('voy a comer y después a estudiar a las 7'), true)
})

test('detecta "luego" como conector multi', () => {
  assert.equal(detect('estudiar a las 3, luego entrenar'), true)
})

test('detecta "también" como conector multi', () => {
  assert.equal(detect('mañana recuérdame mandar el trabajo y también pagar la matrícula'), true)
})

// ─── C) NO debe activarse en frases simples (anti-falso-positivo) ──────────

test('NO marca como multi una frase simple con una sola hora', () => {
  assert.equal(detect('hoy a las 5 gimnasio'), false)
})

test('NO marca como multi un saludo', () => {
  assert.equal(detect('hola'), false)
})

test('NO marca como multi un reminder único', () => {
  // "recuérdame llamar a mamá" — solo trigger, sin verbo de evento → 1 acción.
  // El detector 1b NO debe disparar porque eventVerbRe no encuentra
  // "tengo/voy a/agéndame".
  assert.equal(detect('recuérdame llamar a mi mamá'), false)
})

test('NO marca como multi "comprar pan y leche" (objetos, no acciones)', () => {
  // " y " entre objetos de la misma acción no es multi. Como NO hay
  // ninguna hora ni ningún strongHint específico (solo " y "), debe ser
  // false. El test es exigente: confirma que NO existe un trigger amplio
  // " y " en strongHints.
  assert.equal(detect('comprar pan y leche'), false)
})

test('NO marca como multi una sola hora con coma corta', () => {
  // 25 chars < 70 → la rama de "coma + tiempo + length≥70" no aplica.
  assert.equal(detect('mañana, gimnasio a las 5'), false)
})

// ─── D) Pregunta al asistente (no multi) ────────────────────────────────────

test('NO marca como multi "qué tengo hoy"', () => {
  // Es una pregunta, ningún hint ni timeHits ni "y recuérdame".
  assert.equal(detect('qué tengo hoy'), false)
})

// ─── E) Tipos defensivos ────────────────────────────────────────────────────

test('retorna false ante input no-string', () => {
  assert.equal(detect(null), false)
  assert.equal(detect(undefined), false)
  assert.equal(detect(42), false)
  assert.equal(detect({}), false)
})
