import { test, expect } from '@playwright/test'

async function bootAsReturningUser(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_hint_empty-day-v1', '1')
    localStorage.setItem('focus_install_dismissed', 'true')
  })
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    innerWidth: window.innerWidth,
  }))

  expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.htmlClientWidth + 1)
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1)
  expect(metrics.htmlScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
}

test.describe('Mobile AppShell', () => {
  test.skip(({ browserName }) => browserName !== 'webkit', 'AppShell mobile se valida en WebKit/iPhone.')

  test('mantiene dark boot consistente durante un primer arranque real', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.classList.contains('focus-dark-boot'))

    const surfaces = await page.evaluate(() => {
      const css = getComputedStyle
      const shell = document.querySelector('[data-focus-app-shell]')
      return {
        html: css(document.documentElement).backgroundColor,
        body: css(document.body).backgroundColor,
        root: css(document.getElementById('root')).backgroundColor,
        shell: shell ? css(shell).backgroundColor : null,
      }
    })

    expect(surfaces.html).toBe('rgb(6, 8, 15)')
    expect(surfaces.body).toBe(surfaces.html)
    expect(surfaces.root).toBe(surfaces.html)
    expect(surfaces.shell).toBe(surfaces.html)
  })

  test.describe('usuario recurrente', () => {
    test.beforeEach(async ({ page }) => {
      await bootAsReturningUser(page)
    })

    test('pinta html/body/root/shell con el mismo fondo fuera del boot oscuro', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /mi día/i })).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('[data-focus-app-shell]')).toBeVisible()

      const surfaces = await page.evaluate(() => {
        const css = getComputedStyle
        return {
          html: css(document.documentElement).backgroundColor,
          body: css(document.body).backgroundColor,
          root: css(document.getElementById('root')).backgroundColor,
          shell: css(document.querySelector('[data-focus-app-shell]')).backgroundColor,
          isIOS: document.documentElement.classList.contains('is-ios'),
        }
      })

      expect(surfaces.isIOS).toBeTruthy()
      expect(surfaces.html).toBe(surfaces.body)
      expect(surfaces.root).toBe(surfaces.body)
      expect(surfaces.shell).toBe(surfaces.body)
      await expectNoHorizontalOverflow(page)
    })

    test('mantiene navegación, Nova y teclado simulado dentro del viewport iPhone', async ({ page }) => {
      await page.goto('/?view=calendar')
      await expect(page.getByRole('heading', { name: /calendario/i })).toBeVisible({ timeout: 10_000 })

      for (const label of ['Mi Día', 'Calendario', 'Tareas', 'Ajustes']) {
        await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
      }
      await expectNoHorizontalOverflow(page)

      await page.evaluate(() => {
        document.documentElement.style.setProperty('--focus-visual-viewport-height', '540px')
        document.body.classList.add('keyboard-open')
      })

      await page.getByRole('button', { name: /abrir nova/i }).click()
      const novaInput = page.getByPlaceholder(/escribe o habla/i)
      await expect(novaInput).toBeVisible()
      await novaInput.fill('Agenda una demo mañana')

      const layout = await page.evaluate(() => {
        const sheetRect = document.querySelector('.nova-mobile-sheet')?.getBoundingClientRect()
        const navRect = document.querySelector('nav[aria-label="Navegación principal"]')?.getBoundingClientRect()
        const html = document.documentElement
        const sheet = sheetRect ? {
          left: sheetRect.left,
          right: sheetRect.right,
          width: sheetRect.width,
          height: sheetRect.height,
        } : null
        const nav = navRect ? {
          top: navRect.top,
          bottom: navRect.bottom,
          height: navRect.height,
        } : null
        return {
          sheet,
          nav,
          viewportHeight: parseFloat(getComputedStyle(html).getPropertyValue('--focus-visual-viewport-height')),
          panelZ: Number(getComputedStyle(document.querySelector('[data-nova-mobile-panel]')).zIndex),
          navZ: Number(getComputedStyle(document.querySelector('nav[aria-label="Navegación principal"]')).zIndex),
        }
      })

      expect(layout.sheet.width).toBeLessThanOrEqual(393)
      expect(layout.sheet.left).toBeGreaterThanOrEqual(0)
      expect(layout.sheet.right).toBeLessThanOrEqual(393)
      expect(layout.sheet.height).toBeLessThanOrEqual(layout.viewportHeight + 1)
      expect(layout.panelZ).toBeGreaterThan(layout.navZ)
      await expectNoHorizontalOverflow(page)
    })
  })
})
