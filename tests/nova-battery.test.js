// Validación OFFLINE de la batería QA de Nova.
//
// La batería en sí (tests/nova-battery/cases.json) corre EN VIVO contra
// OpenAI con scripts/run-nova-battery.mjs (requiere OPENAI_API_KEY).
// Estos tests garantizan que el archivo de casos está bien formado y
// cubre todas las categorías del spec, para que el runner nunca falle
// por un typo en una expectativa.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CASES_PATH = join(dirname(fileURLToPath(import.meta.url)), 'nova-battery/cases.json')
const { cases } = JSON.parse(readFileSync(CASES_PATH, 'utf8'))

const KNOWN_EXPECT_KEYS = new Set([
  'kind', 'kindAnyOf', 'allowClarify', 'minActions', 'maxActions',
  'titleIncludes', 'subtitleIncludes', 'subtitleOrLocationIncludes',
  'titleOrSubtitleIncludes', 'subtitleOrSecondActionIncludes',
  'titlesInclude', 'timeAnyOf', 'timesAnyOf', 'timeRelativeMinutes',
  'date', 'endTimeNull', 'durationMinutes', 'maxDurationMinutes',
  'reminderOffsetsInclude', 'targetId', 'updateTime', 'updateDate',
  'replyIncludes', 'noWrongCreate',
])

const KNOWN_KINDS = new Set(['event', 'reminder', 'task', 'chat', 'clarify', 'edit', 'delete', 'multi'])

test('la batería tiene al menos 200 casos (150 spec + 50 extra)', () => {
  assert.ok(cases.length >= 200, `solo hay ${cases.length} casos`)
})

test('ids únicos y bien formados', () => {
  const ids = new Set()
  for (const c of cases) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0)
    assert.ok(!ids.has(c.id), `id duplicado: ${c.id}`)
    ids.add(c.id)
  }
})

test('todos los casos tienen input no vacío y expect válido', () => {
  for (const c of cases) {
    assert.ok(typeof c.input === 'string' && c.input.trim().length > 0, `caso ${c.id} sin input`)
    assert.ok(c.expect && typeof c.expect === 'object', `caso ${c.id} sin expect`)
    for (const key of Object.keys(c.expect)) {
      assert.ok(KNOWN_EXPECT_KEYS.has(key), `caso ${c.id}: expect key desconocida "${key}"`)
    }
    if (c.expect.kind) assert.ok(KNOWN_KINDS.has(c.expect.kind), `caso ${c.id}: kind inválido`)
    for (const k of c.expect.kindAnyOf || []) {
      assert.ok(KNOWN_KINDS.has(k), `caso ${c.id}: kindAnyOf inválido "${k}"`)
    }
    assert.ok(c.expect.kind || c.expect.kindAnyOf || c.expect.minActions != null,
      `caso ${c.id}: expect sin kind ni minActions`)
  }
})

test('cubre las 15 categorías del spec + extras', () => {
  const cats = new Set(cases.map(c => c.cat))
  for (const required of [
    'eventos_simples', 'subtitulos', 'recordatorios', 'duraciones', 'fechas',
    'horas_ambiguas', 'multi', 'contexto', 'conversacion', 'no_crear',
    'informal', 'typos', 'complejos', 'confirmaciones', 'cancelacion',
  ]) {
    assert.ok(cats.has(required), `falta categoría ${required}`)
  }
  const extras = cases.filter(c => c.cat.startsWith('extra_'))
  assert.ok(extras.length >= 50, `solo ${extras.length} casos extra (se piden ≥50)`)
})

test('historiales bien formados (roles user/assistant alternados terminando en assistant)', () => {
  for (const c of cases) {
    if (!c.history) continue
    assert.ok(Array.isArray(c.history), `caso ${c.id}: history no es array`)
    for (const h of c.history) {
      assert.ok(['user', 'assistant'].includes(h.role), `caso ${c.id}: role inválido`)
      assert.ok(typeof h.content === 'string' && h.content.length > 0)
    }
    assert.equal(c.history[c.history.length - 1].role, 'assistant',
      `caso ${c.id}: el history debe terminar con turno de Nova (el input es la respuesta del usuario)`)
  }
})

test('casos edit/delete referencian eventos seed existentes', () => {
  for (const c of cases) {
    const targets = [c.expect.targetId].filter(Boolean)
    for (const t of targets) {
      const ids = (c.events || []).map(e => e.id)
      assert.ok(ids.includes(t), `caso ${c.id}: targetId ${t} no está en events seed`)
    }
  }
})

test('fechas de expectativas usan tokens válidos', () => {
  const valid = v => v === null || ['today', 'tomorrow', '+2'].includes(v)
    || /^weekday:(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)$/.test(v)
    || /^\d{4}-\d{2}-\d{2}$/.test(v)
  for (const c of cases) {
    if (c.expect.date !== undefined) assert.ok(valid(c.expect.date), `caso ${c.id}: date token inválido "${c.expect.date}"`)
    if (c.expect.updateDate !== undefined) assert.ok(valid(c.expect.updateDate), `caso ${c.id}: updateDate inválido`)
    for (const ev of c.events || []) {
      assert.ok(valid(ev.date), `caso ${c.id}: event seed date inválida "${ev.date}"`)
    }
  }
})
