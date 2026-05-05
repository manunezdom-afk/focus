import { test, expect } from '@playwright/test'

// Tests del parsing de acciones que emite Nova. En propose mode (default), las
// acciones no se ejecutan directo: se encolan como sugerencias y se muestran
// como chips "Propuesta: …" debajo del último mensaje. Estos tests validan
// el camino crítico: respuesta del LLM → JSON parseado → chip correcto en UI.
//
// Mockear el endpoint nos permite forzar respuestas conocidas (LLM reales son
// no-determinísticos) y validar bugs específicos de regresión.

const TODAY = new Date().toISOString().slice(0, 10)

async function skipOnboarding(page) {
  await page.addInitScript(() => {
    localStorage.setItem('focus_onboarding_completed_v1', '1')
    localStorage.setItem('focus_welcome_last', new Date().toISOString().slice(0, 10))
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
    localStorage.setItem('focus_boot_splash_seen', '1')
  })
}

async function mockNovaResponse(page, body) {
  await page.route('**/api/focus-assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

async function openNovaAndSend(page, message) {
  const pill = page.getByRole('button', { name: /abrir nova/i })
  await expect(pill).toBeVisible({ timeout: 10_000 })
  await pill.click()
  const input = page.getByPlaceholder(/escribe o habla/i)
  await expect(input).toBeVisible({ timeout: 4_000 })
  await input.fill(message)
  await page.getByRole('button', { name: /enviar mensaje/i }).click()
}

test.describe('Nova — parsing de acciones', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
  })

  test('add_event genera chip "Propuesta: crear ..."', async ({ page }) => {
    await mockNovaResponse(page, {
      reply: 'Lo agendo para hoy a las 14:00.',
      actions: [{
        type: 'add_event',
        event: {
          title: 'Almuerzo con María',
          time: '2:00 PM',
          endTime: '3:00 PM',
          date: TODAY,
          section: 'evening',
          icon: 'restaurant',
        },
      }],
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'almuerzo con maría a las 2 PM')

    // El chip de propuesta debe aparecer con el título exacto
    await expect(page.getByText(/Propuesta: crear "Almuerzo con María"/i)).toBeVisible({ timeout: 6_000 })

    // El botón "Abrir bandeja" aparece para sugerencias propuestas
    await expect(page.getByRole('button', { name: /abrir bandeja/i })).toBeVisible()
  })

  test('add_task genera chip "Propuesta: añadir tarea ..."', async ({ page }) => {
    await mockNovaResponse(page, {
      reply: 'Te lo apunto en tareas.',
      actions: [{
        type: 'add_task',
        task: { label: 'Comprar pan', priority: 'Media', category: 'hoy' },
      }],
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'comprar pan')

    await expect(page.getByText(/Propuesta: añadir tarea "Comprar pan"/i)).toBeVisible({ timeout: 6_000 })
  })

  test('add_recurring_event genera chip único (no N chips)', async ({ page }) => {
    await mockNovaResponse(page, {
      reply: 'Listo, lo agendo todos los lunes por 3 meses.',
      actions: [{
        type: 'add_recurring_event',
        event: { title: 'Yoga', time: '8:00 AM', endTime: '9:00 AM', section: 'focus', icon: 'event' },
        recurrence: { pattern: 'weekly', weekday: 1 },
      }],
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'yoga todos los lunes a las 8')

    // UNA sola propuesta para crear (no 12 chips). El cliente expande al aplicar.
    await expect(page.getByText(/Propuesta: crear recurrente "Yoga"/i)).toBeVisible({ timeout: 6_000 })
    const chips = page.getByText(/Propuesta:/i)
    expect(await chips.count()).toBe(1)
  })

  test('mensaje sin acciones solo muestra reply (no crea propuestas)', async ({ page }) => {
    // Simulación del bug que sufrimos: Nova respondía "Listo, agendé X" sin
    // emitir add_event en branch ambiguous. La defensa del lado cliente es
    // que sin actions, no hay chips de propuesta.
    await mockNovaResponse(page, {
      reply: '¿Cuánto dura? 30 min, 1 h, 2 h, o sin hora de término.',
      actions: [],
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'estudiar Teorías')

    // El reply aparece en el chat
    await expect(page.getByText(/¿Cuánto dura\?/)).toBeVisible({ timeout: 6_000 })

    // Pero NO debe haber ningún chip "Propuesta:"
    await page.waitForTimeout(500)
    expect(await page.getByText(/Propuesta:/i).count()).toBe(0)
    // Tampoco botón "Abrir bandeja" — no hay sugerencias encoladas.
    expect(await page.getByRole('button', { name: /abrir bandeja/i }).count()).toBe(0)
  })

  test('múltiples acciones de tipos distintos generan múltiples chips', async ({ page }) => {
    await mockNovaResponse(page, {
      reply: 'Listo, lo agendo y te dejo la tarea relacionada.',
      actions: [
        {
          type: 'add_event',
          event: { title: 'Reunión con Nico', time: '3:00 PM', endTime: '3:30 PM', date: TODAY, section: 'evening', icon: 'groups' },
        },
        {
          type: 'add_task',
          task: { label: 'Preparar agenda para Nico', category: 'hoy', priority: 'Media' },
        },
      ],
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'reunión con Nico 3pm y prepara agenda')

    await expect(page.getByText(/Propuesta: crear "Reunión con Nico"/i)).toBeVisible({ timeout: 6_000 })
    await expect(page.getByText(/Propuesta: añadir tarea "Preparar agenda para Nico"/i)).toBeVisible()

    // El reply muestra el suffix "+ 2 propuestas" o equivalente plural
    // (el componente decide; aquí solo validamos que ambas chips coexisten)
  })

  test('JSON malformado del backend → mensaje de error legible', async ({ page }) => {
    // Simula el caso de fallback del backend (el handler retorna llm_bad_output
    // tras dos intentos de parse fallidos).
    await page.route('**/api/focus-assistant', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'llm_bad_output',
          reply: 'Tuve un problema procesando la respuesta. Repite el mensaje por favor.',
          actions: [],
        }),
      })
    })
    await page.goto('/?view=calendar')
    await openNovaAndSend(page, 'agenda algo confuso')

    // El cliente decodifica el statusMsg de llm_bad_output. Validamos que el
    // texto del error aparezca, no un spinner colgado o silencio total.
    await expect(page.getByText(/no pude procesarlo|repite|problema/i).first())
      .toBeVisible({ timeout: 6_000 })
  })
})
