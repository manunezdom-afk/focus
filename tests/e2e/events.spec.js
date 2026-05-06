import { test, expect } from '@playwright/test'

// CRUD básico de eventos sin pasar por Nova. Cubre el path manual:
// CalendarView → "Añadir evento" → QuickAddSheet → submit → evento visible.
// Sin auth: la app guarda en localStorage `focus_events` cuando no hay
// userId. Los tests no necesitan Supabase ni mocks de auth.
//
// Mobile-only: el layout desktop tiene sidebar y CTAs distintos. Cubrir
// ambos requeriría duplicar selectors; las regresiones de Capacitor iOS
// (motor real WKWebView) son la prioridad de esta suite.

test.skip(({ browserName }) => browserName !== 'webkit', 'iOS path solo aplica en webkit-mobile')

async function setupCleanState(page) {
  await page.addInitScript(() => {
    // Saltar onboarding y splash para llegar directo al estado utilizable.
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_hint_empty-day-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
    localStorage.setItem('focus_install_dismissed', 'true')
  })
}

test.describe('CRUD de eventos — flujo manual', () => {
  test('crear evento desde CalendarView → aparece en la grilla', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=calendar')
    await page.waitForLoadState('networkidle')

    // Día vacío: aparece el CTA "Añadir evento". Click abre QuickAddSheet.
    const addBtn = page.getByRole('button', { name: /añadir evento/i }).first()
    await addBtn.click()

    // QuickAddSheet visible con título "Añadir evento" y input.
    await expect(page.getByRole('heading', { name: /añadir evento/i })).toBeVisible()

    // Tipear evento natural-language: "reunión cliente 15:00".
    const input = page.locator('input[type="text"]').first()
    await input.fill('reunión cliente 15:00')

    // Esperamos a que el preview parse y el botón Añadir se habilite.
    await page.waitForTimeout(300)

    const submit = page.getByRole('button', { name: /^añadir$/i }).last()
    await expect(submit).toBeEnabled()
    await submit.click()

    // Sheet se cierra y el evento aparece en la grilla del día.
    await expect(page.getByRole('heading', { name: /añadir evento/i })).not.toBeVisible()
    // El evento debería verse con el título "reunión cliente" o similar.
    // Aceptamos cualquier capitalización porque el parser puede normalizar.
    await expect(page.locator('text=/reunión cliente/i').first()).toBeVisible({ timeout: 3000 })
  })

  test('cancelar el sheet no crea evento', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=calendar')
    await page.waitForLoadState('networkidle')

    const addBtn = page.getByRole('button', { name: /añadir evento/i }).first()
    await addBtn.click()

    const input = page.locator('input[type="text"]').first()
    await input.fill('algo que no quiero crear')

    await page.getByRole('button', { name: /cancelar/i }).click()

    await expect(page.getByRole('heading', { name: /añadir evento/i })).not.toBeVisible()
    // El día sigue vacío: el empty state ("Día libre") sigue ahí.
    await expect(page.locator('text=/día libre/i').first()).toBeVisible()
  })

  test('botón Añadir está disabled si el input está vacío', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=calendar')
    await page.waitForLoadState('networkidle')

    const addBtn = page.getByRole('button', { name: /añadir evento/i }).first()
    await addBtn.click()

    // Sin texto el botón "Añadir" está disabled (no hay parsed event).
    const submit = page.getByRole('button', { name: /^añadir$/i }).last()
    await expect(submit).toBeDisabled()
  })
})
