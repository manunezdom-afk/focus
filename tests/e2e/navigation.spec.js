import { test, expect } from '@playwright/test'

// Navegación entre las 4 vistas principales vía BottomNavBar. Si tappear
// un tab no cambia la vista, o si los tabs se quedan stuck en una vista,
// la app es inutilizable. Este test es la red de seguridad mínima.
//
// Mobile-only: en desktop la nav es DesktopSideBar (un <aside>), no
// <nav aria-label="Navegación principal">. Esta suite cubre el path
// móvil que es el target principal del Capacitor app.

test.skip(({ browserName }) => browserName !== 'webkit', 'BottomNavBar es mobile-only')

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_hint_empty-day-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
    localStorage.setItem('focus_install_dismissed', 'true')
  })
}

test.describe('Navegación entre vistas', () => {
  test('los 4 tabs cambian la vista correctamente', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Mi Día (default): se ve el header "Mi Día"
    await expect(page.getByRole('heading', { name: /^mi día$/i }).first()).toBeVisible()

    // Scope a la nav inferior — "calendario" en el topbar también matchea
    // por el botón "Importar / Exportar calendario", strict mode lo rechaza.
    const nav = page.locator('nav[aria-label="Navegación principal"]')

    // Tap Calendario → header "Calendario"
    await nav.getByRole('button', { name: 'Calendario' }).click()
    await expect(page.getByRole('heading', { name: /^calendario$/i }).first()).toBeVisible({ timeout: 4000 })

    // Tap Tareas → header "Tareas"
    await nav.getByRole('button', { name: 'Tareas' }).click()
    await expect(page.getByRole('heading', { name: /^tareas$/i }).first()).toBeVisible({ timeout: 4000 })

    // Tap Ajustes → header "Ajustes"
    await nav.getByRole('button', { name: 'Ajustes' }).click()
    await expect(page.getByRole('heading', { name: /^ajustes$/i }).first()).toBeVisible({ timeout: 4000 })

    // Volver a Mi Día → header "Mi Día"
    await nav.getByRole('button', { name: 'Mi Día' }).click()
    await expect(page.getByRole('heading', { name: /^mi día$/i }).first()).toBeVisible({ timeout: 4000 })
  })

  test('aria-current="page" se actualiza al cambiar de tab', async ({ page }) => {
    await setup(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // En Mi Día, el botón "Mi Día" tiene aria-current="page".
    const miDiaTab = page.locator('nav[aria-label="Navegación principal"] button[aria-label="Mi Día"]')
    await expect(miDiaTab).toHaveAttribute('aria-current', 'page')

    // Cambiar a Tareas → ese botón debe tener aria-current="page".
    await page.locator('nav[aria-label="Navegación principal"]').getByRole('button', { name: 'Tareas' }).click()
    const tareasTab = page.locator('nav[aria-label="Navegación principal"] button[aria-label="Tareas"]')
    await expect(tareasTab).toHaveAttribute('aria-current', 'page')
    // Y Mi Día ya no.
    await expect(miDiaTab).not.toHaveAttribute('aria-current', 'page')
  })

  test('reload preserva la vista activa via querystring', async ({ page }) => {
    await setup(page)
    // Llegar a una vista vía query y recargar — la app respeta el ?view=
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^tareas$/i }).first()).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^tareas$/i }).first()).toBeVisible({ timeout: 4000 })
  })
})
