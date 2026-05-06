import { test, expect } from '@playwright/test'

// Persistencia local — diseño actual:
//
// Sin sesión, la app NO escribe ni rehidrata eventos/tareas desde localStorage
// (ver useEvents.js:223 y useTasks.js: misma lógica). Sólo escribe la caché
// cuando hay user.id, para evitar "tareas fantasma" cross-cuenta. Por tanto:
//   · No tiene sentido testear "sobrevive al reload sin auth" — by-design no.
//   · Tests con auth real necesitan Supabase mockeado: out of scope acá.
//
// Lo que SÍ testeamos: que datos corruptos en las keys de localStorage no
// rompan el arranque. Es la red de seguridad mínima para que un bug en una
// versión vieja del schema no deje al usuario con pantalla en blanco.
//
// El test "estado in-memory" usa BottomNavBar (mobile-only).

test.skip(({ browserName }) => browserName !== 'webkit', 'BottomNavBar es mobile-only')

test.describe('Persistencia en localStorage', () => {
  test('localStorage corrupto no rompe la app — arranca con estado vacío', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('focus_onboarding_completed_v1', '1')
      localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
      localStorage.setItem('focus_hint_welcome-intro-v1', '1')
      localStorage.setItem('focus_hint_empty-day-v1', '1')
      localStorage.setItem('focus_boot_splash_seen', '1')
      localStorage.setItem('focus_install_dismissed', 'true')
      // Basura intencional en las keys principales — simulando una versión
      // vieja con schema incompatible o corrupción del store.
      localStorage.setItem('focus_tasks', '{not valid json[[[')
      localStorage.setItem('focus_events', 'también basura {{{')
      localStorage.setItem('focus_user_profile', 'no es JSON tampoco')
    })

    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    // Si la app crashea, el header "Tareas" nunca se monta y vemos pantalla
    // blanca. Si llegamos a renderizarlo, el guard de cacheGet (try/catch
    // en dataService.js:5-12) está haciendo su trabajo.
    await expect(page.getByRole('heading', { name: /^tareas$/i }).first()).toBeVisible({ timeout: 4000 })
  })

  test('estado in-memory se mantiene al cambiar de vista (sin reload)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('focus_onboarding_completed_v1', '1')
      localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
      localStorage.setItem('focus_hint_welcome-intro-v1', '1')
      localStorage.setItem('focus_hint_empty-day-v1', '1')
      localStorage.setItem('focus_boot_splash_seen', '1')
      localStorage.setItem('focus_install_dismissed', 'true')
    })
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    // Crear tarea en Tareas.
    await page.getByRole('button', { name: /añadir tarea a hoy/i }).first().click()
    await page.getByPlaceholder(/qué necesitas hacer/i).fill('memoria viva')
    await page.getByRole('button', { name: /^añadir$/i }).last().click()
    await expect(page.locator('text=/memoria viva/i').first()).toBeVisible()

    const nav = page.locator('nav[aria-label="Navegación principal"]')

    // Ir a Calendario y volver — el state del hook vive en memoria mientras
    // la sesión esté abierta, así que la tarea sigue ahí.
    await nav.getByRole('button', { name: 'Calendario' }).click()
    await expect(page.getByRole('heading', { name: /^calendario$/i }).first()).toBeVisible()

    await nav.getByRole('button', { name: 'Tareas' }).click()
    await expect(page.locator('text=/memoria viva/i').first()).toBeVisible({ timeout: 3000 })
  })
})
