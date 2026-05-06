import { test, expect } from '@playwright/test'

// CRUD básico de tareas sin Nova. Cubre el path manual:
// TasksView → "Añadir tarea a Hoy" → inline form → submit → tarea visible.
// Sin auth: la app guarda en localStorage `focus_tasks` cuando no hay
// userId. Los tests no necesitan Supabase ni mocks de auth.

async function setupCleanState(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_hint_empty-day-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
    localStorage.setItem('focus_install_dismissed', 'true')
  })
}

test.describe('CRUD de tareas — flujo manual', () => {
  test('crear tarea en "Hoy" → aparece en la lista', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    // Lista vacía: el CTA del empty state es "Añadir tarea a Hoy".
    const addBtn = page.getByRole('button', { name: /añadir tarea a hoy/i }).first()
    await addBtn.click()

    // Form inline: input con autoFocus para tipear directo.
    const input = page.getByPlaceholder(/qué necesitas hacer/i)
    await expect(input).toBeVisible()
    await input.fill('terminar reporte trimestral')

    const submit = page.getByRole('button', { name: /^añadir$/i }).last()
    await submit.click()

    // La tarea aparece en la lista. El input se vacía pero queda abierto
    // para rapid-fire (UX intencional; ver TasksView.jsx:54).
    // Strict mode: hay 2 matches (NextWindowPanel "· terminar reporte..."
    // y la fila de la tarea). first() agarra el match más arriba en el DOM.
    await expect(page.locator('text=/terminar reporte trimestral/i').first()).toBeVisible({ timeout: 3000 })
  })

  test('feedback tras crear tarea: input cambia a placeholder "Añade otra tarea…"', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    const addBtn = page.getByRole('button', { name: /añadir tarea a hoy/i }).first()
    await addBtn.click()

    let input = page.getByPlaceholder(/qué necesitas hacer/i)
    await input.fill('comprar pan')
    await page.getByRole('button', { name: /^añadir$/i }).last().click()

    // Tras el primer add, el placeholder cambia a "Añade otra tarea…" como
    // affordance de rapid-fire. Es el feedback que confirma que el add
    // funcionó sin tener que escanear la lista entera.
    await expect(page.getByPlaceholder(/añade otra tarea/i)).toBeVisible({ timeout: 1500 })
  })

  test('toggle done: tap al checkmark marca/desmarca la tarea', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    // Crear una tarea para tener algo que togglear.
    await page.getByRole('button', { name: /añadir tarea a hoy/i }).first().click()
    await page.getByPlaceholder(/qué necesitas hacer/i).fill('toggle test')
    await page.getByRole('button', { name: /^añadir$/i }).last().click()

    // Cerrar el form inline para que no obstruya.
    await page.getByRole('button', { name: /cerrar/i }).click()

    // Estado inicial: progress dice "0 / 1 completadas"
    await expect(page.locator('text=/0 \\/ 1 completadas/i')).toBeVisible()

    // Click en el checkmark de la tarea (TaskCheckmark es un button con
    // aria-label específico). Buscamos el círculo asociado al label.
    const taskRow = page.locator('text=/toggle test/i').locator('..')
    await taskRow.locator('button').first().click()

    // Después del toggle: 1/1 completadas
    await expect(page.locator('text=/1 \\/ 1 completadas/i')).toBeVisible({ timeout: 2000 })
  })

  test('botón Añadir está disabled si el input está vacío', async ({ page }) => {
    await setupCleanState(page)
    await page.goto('/?view=tasks')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /añadir tarea a hoy/i }).first().click()

    const submit = page.getByRole('button', { name: /^añadir$/i }).last()
    await expect(submit).toBeDisabled()
  })
})
