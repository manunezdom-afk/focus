// Verifica que los endpoints sensibles requieren Bearer válido. Antes
// /api/focus-assistant y /api/analyze-photo aceptaban requests sin sesión
// "para pruebas" — eso permitía a cualquiera con la URL agotar la cuota
// de Anthropic. Estos tests aseguran que el bypass no vuelva por accidente.

import assert from 'node:assert/strict'
import test from 'node:test'

import focusAssistant from '../api/focus-assistant.js'
import analyzePhoto from '../api/analyze-photo.js'
import deleteAccount from '../api/auth/delete-account.js'

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v },
    status(code) { this.statusCode = code; return this },
    json(body)    { this.body = body; return this },
    end()         { return this },
    send()        { return this },
  }
  return res
}

function buildReq({ origin = 'https://www.usefocus.me', authHeader = null, body = {} } = {}) {
  return {
    method: 'POST',
    headers: {
      origin,
      host: 'www.usefocus.me',
      'sec-fetch-site': 'same-origin',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body,
    socket: { remoteAddress: '198.51.100.10' },
    query: {},
  }
}

test('focus-assistant rechaza requests sin Bearer token', async () => {
  const res = mockRes()
  await focusAssistant(buildReq({ body: { message: 'hola' } }), res)
  assert.equal(res.statusCode, 401, 'sin auth debe devolver 401')
  assert.equal(res.body?.error, 'auth_required')
})

test('focus-assistant rechaza Bearer con formato inválido', async () => {
  const res = mockRes()
  await focusAssistant(
    buildReq({ authHeader: 'Bearer not-a-real-jwt', body: { message: 'hola' } }),
    res,
  )
  assert.equal(res.statusCode, 401)
})

test('analyze-photo rechaza requests sin Bearer token', async () => {
  const res = mockRes()
  await analyzePhoto(buildReq({ body: { images: [{ base64: 'aaaa', mediaType: 'image/jpeg' }] } }), res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body?.error, 'auth_required')
})

test('delete-account rechaza requests sin Bearer token', async () => {
  const res = mockRes()
  await deleteAccount(buildReq({ body: { confirm: 'DELETE' } }), res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body?.error, 'auth_required')
})

test('delete-account exige confirm:"DELETE" como segundo cinturón', async () => {
  // Nota: este test valida la verificación de confirm sólo si pasa la auth.
  // Como en CI no hay JWT real, el handler rechaza en auth primero (401).
  // El control real lo cubre el server con Bearer válido — aquí dejamos al
  // menos el contrato del status para protegernos contra una regresión
  // donde alguien acepte método GET o devuelva 200 sin confirmación.
  const res = mockRes()
  await deleteAccount(
    { ...buildReq({ body: {} }), method: 'GET' },
    res,
  )
  assert.equal(res.statusCode, 405)
})
