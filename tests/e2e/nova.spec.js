import { test, expect } from '@playwright/test'

// Mock helpers — interceptan los endpoints de IA antes de que el cliente
// llame a Anthropic. Cada test elige el comportamiento del mock (éxito,
// error, timeout) y verifica el feedback loop de Nova en la UI.

const TODAY = new Date().toISOString().slice(0, 10)

async function skipOnboarding(page) {
  // Setea localStorage ANTES del primer load para skip BootSplash/Welcome/
  // FirstLaunchOnboarding y aterrizar directo en el planner.
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
  })
}

async function mockNovaSuccess(page, replyText = 'Listo, te ayudo con eso.') {
  await page.route('**/api/focus-assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: replyText, actions: [] }),
    })
  })
}

async function mockNovaError(page, status = 503, errorCode = 'upstream_overloaded') {
  await page.route('**/api/focus-assistant', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorCode, message: 'Servicio sobrecargado.' }),
    })
  })
}

async function mockNovaSlow(page, delayMs = 2000) {
  await page.route('**/api/focus-assistant', async (route) => {
    await new Promise((r) => setTimeout(r, delayMs))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Tardé, pero llegué.', actions: [] }),
    })
  })
}

async function openNova(page) {
  // NovaWidget solo monta en vistas no-planner (en planner Nova vive en
  // FocusBar). Aterrizamos en calendar para tener el botón "Abrir Nova".
  // El tap es un pointerdown→up rápido — Playwright .click() simula eso
  // sin disparar el long-press de 500ms.
  const pill = page.getByRole('button', { name: /abrir nova/i })
  await expect(pill).toBeVisible({ timeout: 10_000 })
  await pill.click()
  await expect(page.getByPlaceholder(/escribe o habla/i)).toBeVisible({ timeout: 4_000 })
}

async function gotoCalendar(page) {
  await page.goto('/?view=calendar')
}

test.describe('Nova — feedback loop', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
  })

  test('mensaje del usuario aparece y respuesta llega; loading desaparece', async ({ page }) => {
    await mockNovaSuccess(page, 'Te lo agendo para mañana.')
    await gotoCalendar(page)
    await openNova(page)

    const input = page.getByPlaceholder(/escribe o habla/i)
    await input.fill('Agenda gym mañana a las 7')

    const sendBtn = page.getByRole('button', { name: /enviar mensaje/i })
    await expect(sendBtn).toBeEnabled()
    await sendBtn.click()

    // El mensaje del usuario debe aparecer en el chat inmediatamente
    await expect(page.getByText('Agenda gym mañana a las 7')).toBeVisible()

    // Loading: la burbuja de dots o el texto del stream
    // (no validamos directamente; solo que la respuesta termine apareciendo)

    // Respuesta del assistant
    await expect(page.getByText('Te lo agendo para mañana.')).toBeVisible({ timeout: 8_000 })

    // Input se limpió
    await expect(input).toHaveValue('')

    // Send button se reactiva (vuelve a deshabilitarse porque input está vacío,
    // pero no debe estar en loading): probamos escribiendo otra vez
    await input.fill('otro mensaje')
    await expect(sendBtn).toBeEnabled()
  })

  test('error de API muestra mensaje claro y libera el botón', async ({ page }) => {
    await mockNovaError(page, 503, 'upstream_overloaded')
    await gotoCalendar(page)
    await openNova(page)

    const input = page.getByPlaceholder(/escribe o habla/i)
    await input.fill('Hola')

    const sendBtn = page.getByRole('button', { name: /enviar mensaje/i })
    await sendBtn.click()

    // Mensaje de error en el chat (no spinner colgado para siempre)
    await expect(page.getByText(/sobrecargado|disponible|error/i).first()).toBeVisible({ timeout: 8_000 })

    // Input se reactiva tras el error
    await input.fill('reintento')
    await expect(sendBtn).toBeEnabled()
  })

  test('doble click en send no duplica el mensaje', async ({ page }) => {
    let calls = 0
    await page.route('**/api/focus-assistant', async (route) => {
      calls++
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: `Respuesta ${calls}`, actions: [] }),
      })
    })
    await gotoCalendar(page)
    await openNova(page)

    const input = page.getByPlaceholder(/escribe o habla/i)
    await input.fill('test doble submit')

    const sendBtn = page.getByRole('button', { name: /enviar mensaje/i })
    // Doble click rápido (race entre setIsLoading y disabled)
    await sendBtn.click()
    await sendBtn.click({ force: true }).catch(() => {})  // si está disabled, ignorar

    // Esperar respuesta
    await expect(page.getByText(/Respuesta 1/)).toBeVisible({ timeout: 8_000 })

    // Solo una request al backend (el guard interno debe detener el segundo)
    expect(calls).toBe(1)
  })

  test('botón send se deshabilita durante carga', async ({ page }) => {
    await mockNovaSlow(page, 1500)
    await gotoCalendar(page)
    await openNova(page)

    const input = page.getByPlaceholder(/escribe o habla/i)
    await input.fill('mensaje lento')

    const sendBtn = page.getByRole('button', { name: /enviar mensaje/i })
    await sendBtn.click()

    // Mientras carga, el send debe estar disabled. Validamos durante 500ms.
    await expect(sendBtn).toBeDisabled()

    // Y al final llega la respuesta y se libera
    await expect(page.getByText('Tardé, pero llegué.')).toBeVisible({ timeout: 5_000 })
  })

  test('cerrar Nova durante loading no rompe la UI al reabrir', async ({ page }) => {
    await mockNovaSlow(page, 1500)
    await gotoCalendar(page)
    await openNova(page)

    const input = page.getByPlaceholder(/escribe o habla/i)
    await input.fill('mensaje en background')
    await page.getByRole('button', { name: /enviar mensaje/i }).click()

    // Cerramos Nova mientras carga
    await page.getByRole('button', { name: /cerrar nova/i }).click()

    // Reabrimos
    await page.getByRole('button', { name: /abrir nova/i }).click()

    // El mensaje del usuario debe seguir en el chat (historyRef persiste)
    await expect(page.getByText('mensaje en background')).toBeVisible({ timeout: 4_000 })
    // Y la respuesta termina llegando
    await expect(page.getByText('Tardé, pero llegué.')).toBeVisible({ timeout: 5_000 })
  })

  test('input vacío con send disabled no envía', async ({ page }) => {
    let called = false
    await page.route('**/api/focus-assistant', async (route) => {
      called = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"reply":"x","actions":[]}' })
    })
    await gotoCalendar(page)
    await openNova(page)

    const sendBtn = page.getByRole('button', { name: /enviar mensaje/i })
    await expect(sendBtn).toBeDisabled()
    await sendBtn.click({ force: true }).catch(() => {})

    // Pequeña espera para asegurar que ningún request salió
    await page.waitForTimeout(500)
    expect(called).toBe(false)
  })
})
