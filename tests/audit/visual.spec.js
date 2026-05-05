import { test } from '@playwright/test'

// Captura screenshots de las vistas principales en webkit-mobile (motor real
// de iOS) para auditar bugs visuales: safe areas, modales, teclado, scroll,
// botones tapados, textos cortados. Los archivos quedan en test-results/audit/
// para revisión manual rápida tras cada fase.
//
// Solo corre en webkit-mobile — desktop tiene otro layout y no aporta señal
// de bugs específicos de iPhone.

test.skip(({ browserName }) => browserName !== 'webkit', 'Solo iOS WebKit')

const VIEWS = [
  { name: 'planner', path: '/' },
  { name: 'calendar', path: '/?view=calendar' },
  { name: 'tasks', path: '/?view=tasks' },
  { name: 'settings', path: '/?view=settings' },
]

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
  })
}

for (const v of VIEWS) {
  test(`screenshot: ${v.name}`, async ({ page }) => {
    await setup(page)
    await page.goto(v.path)
    // Esperamos a que el skeleton del Suspense fallback desaparezca (la vista
    // lazy ya hizo mount). Usamos un selector específico por vista que solo
    // existe tras el mount real, no en el skeleton.
    await page.waitForLoadState('networkidle')
    if (v.name === 'calendar') await page.waitForSelector('text=/calendario/i', { timeout: 8000 })
    if (v.name === 'tasks') await page.waitForSelector('text=Tareas', { timeout: 8000 })
    if (v.name === 'settings') await page.waitForSelector('text=Ajustes', { timeout: 8000 })
    await page.waitForTimeout(800)
    // Viewport-only (no fullPage): así vemos exactamente lo que el usuario
    // ve sin hacer scroll. Si la nav bar tapa algo aquí, es bug real.
    await page.screenshot({ path: `test-results/audit/${v.name}.png` })
    // También fullPage para auditar el resto del scroll
    await page.screenshot({ path: `test-results/audit/${v.name}-full.png`, fullPage: true })
  })

  test(`screenshot: ${v.name} con Nova abierto`, async ({ page }) => {
    if (v.name === 'planner') return // FocusBar embebida en planner, no NovaWidget
    await setup(page)
    await page.goto(v.path)
    await page.waitForTimeout(1200)
    const pill = page.getByRole('button', { name: /abrir nova/i })
    if (await pill.count() > 0) {
      await pill.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `test-results/audit/${v.name}-nova.png`, fullPage: true })
    }
  })
}

test('screenshot: Nova con teclado simulado', async ({ page }) => {
  await setup(page)
  await page.goto('/?view=calendar')
  await page.waitForTimeout(1200)
  const pill = page.getByRole('button', { name: /abrir nova/i })
  await pill.click()
  await page.waitForTimeout(400)
  const input = page.getByPlaceholder(/escribe o habla/i)
  await input.click()
  await input.fill('escribiendo algo aquí mientras pruebo el layout')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/audit/nova-keyboard.png', fullPage: true })
})
