// Tests del helper src/lib/privacyCleanup.js
//
// Como Node.js no trae window/localStorage, montamos un mínimo polyfill
// que basta para los tests. No queremos jsdom solo para esto.

import assert from 'node:assert/strict'
import test from 'node:test'

class FakeStorage {
  constructor() { this.store = new Map() }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null }
  setItem(k, v) { this.store.set(k, String(v)) }
  removeItem(k) { this.store.delete(k) }
  get length() { return this.store.size }
  key(i) { return [...this.store.keys()][i] ?? null }
  clear() { this.store.clear() }
}

async function withFakeStorages(fn) {
  const localBackup = globalThis.localStorage
  const sessionBackup = globalThis.sessionStorage
  const fakeLs = new FakeStorage()
  const fakeSs = new FakeStorage()
  globalThis.localStorage = fakeLs
  globalThis.sessionStorage = fakeSs
  try {
    // IMPORTANTE: await — sin esto el finally restaura globalThis ANTES
    // que el callback async termine y el helper opera sobre el storage
    // real (undefined en Node).
    await fn(fakeLs, fakeSs)
  } finally {
    globalThis.localStorage = localBackup
    globalThis.sessionStorage = sessionBackup
  }
}

const USER_A = '00000000-0000-0000-0000-000000000aaa'
const USER_B = '00000000-0000-0000-0000-000000000bbb'

// Importación dinámica para que el polyfill esté listo antes
async function loadModule() {
  return await import('../src/lib/privacyCleanup.js')
}

// ─── clearPrivateUserDataLocal ──────────────────────────────────────────────

test('clearPrivateUserDataLocal borra tareas/eventos del user actual', async () => {
  await withFakeStorages(async (ls) => {
    const { clearPrivateUserDataLocal } = await loadModule()
    ls.setItem(`focus_events_${USER_A}`, JSON.stringify([{ id: 1 }]))
    ls.setItem(`focus_tasks_${USER_A}`, JSON.stringify([{ id: 2 }]))
    ls.setItem('focus_user_profile', JSON.stringify({ name: 'X' }))
    ls.setItem('focus_user_memories', JSON.stringify([{ c: 'algo' }]))
    clearPrivateUserDataLocal()
    assert.equal(ls.getItem(`focus_events_${USER_A}`), null)
    assert.equal(ls.getItem(`focus_tasks_${USER_A}`), null)
    assert.equal(ls.getItem('focus_user_profile'), null)
    assert.equal(ls.getItem('focus_user_memories'), null)
  })
})

test('clearPrivateUserDataLocal NO borra flags UX', async () => {
  await withFakeStorages(async (ls) => {
    const { clearPrivateUserDataLocal } = await loadModule()
    ls.setItem('focus_welcome_last', '2026-05-07')
    ls.setItem('focus_hint_welcome-intro-v1', '1')
    ls.setItem('focus_nova_tutorial_dismissed', '1')
    ls.setItem('focus:day_started:2026-05-07', '1')
    clearPrivateUserDataLocal()
    assert.equal(ls.getItem('focus_welcome_last'), '2026-05-07')
    assert.equal(ls.getItem('focus_hint_welcome-intro-v1'), '1')
    assert.equal(ls.getItem('focus_nova_tutorial_dismissed'), '1')
    assert.equal(ls.getItem('focus:day_started:2026-05-07'), '1')
  })
})

test('clearPrivateUserDataLocal limpia push subscription pendiente', async () => {
  await withFakeStorages(async (ls) => {
    const { clearPrivateUserDataLocal } = await loadModule()
    ls.setItem('focus_pending_push_sub', JSON.stringify({ endpoint: 'https://fcm', keys: {} }))
    ls.setItem('focus_pending_native_token', 'abc123')
    clearPrivateUserDataLocal()
    assert.equal(ls.getItem('focus_pending_push_sub'), null,
      'pending push sub debe limpiarse para no aplicarse a otro usuario')
    assert.equal(ls.getItem('focus_pending_native_token'), null)
  })
})

test('clearPrivateUserDataLocal limpia datos del usuario aunque haya 2 usuarios', async () => {
  await withFakeStorages(async (ls) => {
    const { clearPrivateUserDataLocal } = await loadModule()
    ls.setItem(`focus_events_${USER_A}`, '[]')
    ls.setItem(`focus_events_${USER_B}`, '[]')
    ls.setItem(`focus_tasks_${USER_A}`, '[]')
    clearPrivateUserDataLocal()
    // Borra TODO lo que matche el prefijo, sin discriminar por user_id —
    // si dos personas usaron el mismo dispositivo en el mismo Chrome, al
    // logout se va todo.
    assert.equal(ls.getItem(`focus_events_${USER_A}`), null)
    assert.equal(ls.getItem(`focus_events_${USER_B}`), null)
    assert.equal(ls.getItem(`focus_tasks_${USER_A}`), null)
  })
})

test('clearPrivateUserDataLocal limpia sessionStorage de Nova', async () => {
  await withFakeStorages(async (_ls, ss) => {
    const { clearPrivateUserDataLocal } = await loadModule()
    ss.setItem('nova_history', JSON.stringify([{ role: 'user', content: 'mensaje secreto' }]))
    ss.setItem('focus_pending_nova_seed', 'seed')
    ss.setItem('focus_auth_pending', 'pending')
    clearPrivateUserDataLocal()
    assert.equal(ss.getItem('nova_history'), null,
      'historial Nova en sessionStorage debe limpiarse al logout')
    assert.equal(ss.getItem('focus_pending_nova_seed'), null)
    assert.equal(ss.getItem('focus_auth_pending'), null)
  })
})

// ─── clearAllUserDataLocal ──────────────────────────────────────────────────

test('clearAllUserDataLocal borra TODO incluyendo flags UX', async () => {
  await withFakeStorages(async (ls) => {
    const { clearAllUserDataLocal } = await loadModule()
    // Datos privados
    ls.setItem(`focus_events_${USER_A}`, '[]')
    ls.setItem('focus_user_profile', '{}')
    // Flags UX
    ls.setItem('focus_welcome_last', '2026-05-07')
    ls.setItem('focus_hint_welcome-intro-v1', '1')
    ls.setItem('focus:day_started:2026-05-07', '1')
    ls.setItem('focus_app_prefs_v1', '{}')
    ls.setItem('focus_nova_tutorial_dismissed', '1')

    clearAllUserDataLocal()

    assert.equal(ls.getItem(`focus_events_${USER_A}`), null)
    assert.equal(ls.getItem('focus_user_profile'), null)
    assert.equal(ls.getItem('focus_welcome_last'), null)
    assert.equal(ls.getItem('focus_hint_welcome-intro-v1'), null)
    assert.equal(ls.getItem('focus:day_started:2026-05-07'), null)
    assert.equal(ls.getItem('focus_app_prefs_v1'), null)
    assert.equal(ls.getItem('focus_nova_tutorial_dismissed'), null)
  })
})

test('clearAllUserDataLocal NO borra claves no relacionadas a Focus', async () => {
  await withFakeStorages(async (ls) => {
    const { clearAllUserDataLocal } = await loadModule()
    ls.setItem('react-router:state', '{}')
    ls.setItem('analytics_uid', 'abc')
    clearAllUserDataLocal()
    // Mantenemos lo de otros frameworks/scripts: solo borramos lo que
    // sabemos que es Focus.
    assert.equal(ls.getItem('react-router:state'), '{}')
    assert.equal(ls.getItem('analytics_uid'), 'abc')
  })
})

// ─── Defensive: no crashea sin storage ──────────────────────────────────────

test('clearPrivateUserDataLocal no rompe si localStorage tira', async () => {
  const { clearPrivateUserDataLocal } = await loadModule()
  const originalLs = globalThis.localStorage
  const originalSs = globalThis.sessionStorage
  // Forzamos una storage que tira en cada acceso
  globalThis.localStorage = new Proxy({}, {
    get() { throw new Error('SecurityError') },
  })
  globalThis.sessionStorage = new Proxy({}, {
    get() { throw new Error('SecurityError') },
  })
  try {
    // No debe lanzar
    clearPrivateUserDataLocal()
  } finally {
    globalThis.localStorage = originalLs
    globalThis.sessionStorage = originalSs
  }
})
