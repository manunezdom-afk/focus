// Tests de src/utils/authErrors.js
//
// Verifica que NUNCA filtramos al usuario el texto crudo del error de
// Supabase. Cada error pasa por humanizeAuthError() y termina en uno de
// los mensajes en español de PATTERNS o el fallback genérico.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  humanizeAuthError,
  isValidEmail,
  isRateLimitError,
  extractRetryAfterSec,
  passwordStrength,
  isAcceptablePassword,
} from '../src/utils/authErrors.js'

// ─── humanizeAuthError ──────────────────────────────────────────────────────

test('humanizeAuthError sin error devuelve mensaje neutro', () => {
  assert.match(humanizeAuthError(null), /Algo salió mal/)
  assert.match(humanizeAuthError(undefined), /Algo salió mal/)
})

test('humanizeAuthError fallback no expone el mensaje crudo', () => {
  const out = humanizeAuthError({ message: 'EXTRAÑO_ERROR_INTERNO_SUPABASE_xyz_42' })
  assert.ok(!/EXTRAÑO_ERROR_INTERNO_SUPABASE/i.test(out),
    'no debe filtrar texto crudo del provider al usuario')
  assert.match(out, /No pudimos completar/)
})

test('humanizeAuthError detecta OTP expirado', () => {
  const out = humanizeAuthError({ message: 'Token has expired or is invalid' })
  assert.match(out, /código.*incorrecto|código.*expir/i)
})

test('humanizeAuthError detecta credenciales inválidas', () => {
  const out = humanizeAuthError({ message: 'Invalid login credentials' })
  assert.match(out, /Email o contraseña incorrectos/)
})

test('humanizeAuthError detecta usuario ya registrado', () => {
  const out = humanizeAuthError({ message: 'User already registered' })
  assert.match(out, /Ya existe una cuenta/)
})

test('humanizeAuthError detecta password débil', () => {
  const out = humanizeAuthError({ message: 'Password should be at least 6 characters' })
  assert.match(out, /6 caracteres/)
})

test('humanizeAuthError detecta email inválido', () => {
  const out = humanizeAuthError({ message: 'Unable to validate email address' })
  assert.match(out, /email no es válido/i)
})

test('humanizeAuthError detecta network error', () => {
  const out = humanizeAuthError({ message: 'Failed to fetch' })
  assert.match(out, /No hay conexión/)
})

test('humanizeAuthError detecta rate limit', () => {
  const out = humanizeAuthError({ message: 'For security purposes, you can only request this after 47 seconds.' })
  assert.match(out, /Demasiados intentos/)
})

test('humanizeAuthError detecta email no confirmado', () => {
  const out = humanizeAuthError({ message: 'Email not confirmed' })
  assert.match(out, /Confirma tu email/)
})

test('humanizeAuthError trabaja con Error real, no solo objeto plano', () => {
  const err = new Error('Failed to fetch')
  err.code = 'NetworkError'
  assert.match(humanizeAuthError(err), /No hay conexión/)
})

test('humanizeAuthError maneja error_description (formato OAuth)', () => {
  assert.match(
    humanizeAuthError({ error_description: 'Invalid login credentials' }),
    /Email o contraseña incorrectos/,
  )
})

// ─── isRateLimitError ───────────────────────────────────────────────────────

test('isRateLimitError detecta status 429', () => {
  assert.equal(isRateLimitError({ status: 429, message: 'whatever' }), true)
})

test('isRateLimitError detecta por mensaje', () => {
  assert.equal(isRateLimitError({ message: 'rate limit exceeded' }), true)
  assert.equal(isRateLimitError({ message: 'too many requests' }), true)
  assert.equal(isRateLimitError({ message: 'For security purposes...' }), true)
})

test('isRateLimitError sin error devuelve false', () => {
  assert.equal(isRateLimitError(null), false)
  assert.equal(isRateLimitError(undefined), false)
  assert.equal(isRateLimitError({}), false)
})

// ─── extractRetryAfterSec ───────────────────────────────────────────────────

test('extractRetryAfterSec lee segundos del mensaje de Supabase', () => {
  const sec = extractRetryAfterSec({
    message: 'For security purposes, you can only request this after 47 seconds.',
  })
  assert.equal(sec, 47)
})

test('extractRetryAfterSec devuelve null si no hay segundos', () => {
  assert.equal(extractRetryAfterSec({ message: 'rate limit' }), null)
  assert.equal(extractRetryAfterSec(null), null)
})

test('extractRetryAfterSec capa los valores fuera de rango', () => {
  // Cap a 3600 (1h) defensivo
  assert.equal(extractRetryAfterSec({ message: 'after 99999 seconds' }), 3600)
  assert.equal(extractRetryAfterSec({ message: 'after 0 seconds' }), 1)
})

// ─── isValidEmail ───────────────────────────────────────────────────────────

test('isValidEmail acepta emails válidos', () => {
  assert.equal(isValidEmail('foo@bar.com'), true)
  assert.equal(isValidEmail('user+tag@example.co.uk'), true)
  assert.equal(isValidEmail('CAPS@CAPS.COM'), true)
})

test('isValidEmail rechaza emails inválidos', () => {
  assert.equal(isValidEmail('no-at-sign'), false)
  assert.equal(isValidEmail('@nouser.com'), false)
  assert.equal(isValidEmail('user@'), false)
  assert.equal(isValidEmail('user@no-tld'), false)
  assert.equal(isValidEmail('user@x.a'), false)  // TLD < 2
  assert.equal(isValidEmail(''), false)
  assert.equal(isValidEmail(null), false)
  assert.equal(isValidEmail(undefined), false)
})

test('isValidEmail rechaza emails > 254 chars', () => {
  const long = 'a'.repeat(250) + '@x.com'
  assert.equal(isValidEmail(long), false)
})

// ─── passwordStrength + isAcceptablePassword ────────────────────────────────

test('passwordStrength clasifica por longitud y variedad', () => {
  assert.equal(passwordStrength(''), 0)
  assert.equal(passwordStrength('123'), 0)             // < 6
  assert.equal(passwordStrength('aaaaaa'), 1)          // 6, solo lower
  assert.equal(passwordStrength('aaaaaaaa'), 1)        // 8, solo lower
  assert.equal(passwordStrength('Aaaaaaaa'), 2)        // 8, lower+upper
  assert.equal(passwordStrength('Aaaaaaa1'), 3)        // 8, 3 tipos
  assert.equal(passwordStrength('Aaaaaaaaaaa1'), 4)    // 12, 3 tipos
})

test('isAcceptablePassword exige al menos 8 caracteres', () => {
  assert.equal(isAcceptablePassword('1234567'), false)
  assert.equal(isAcceptablePassword('12345678'), true)
  assert.equal(isAcceptablePassword(''), false)
  assert.equal(isAcceptablePassword(null), false)
  assert.equal(isAcceptablePassword(undefined), false)
})
