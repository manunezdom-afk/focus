import { defineConfig, devices } from '@playwright/test'

// Tests E2E de Focus. Levantan Vite en background, mockean los endpoints de
// IA con `page.route` para no quemar cuota de Anthropic ni depender de red,
// y validan el feedback loop crítico de Nova: enviar mensaje, ver loading,
// recibir respuesta, no doble submit, errores claros.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 14 Pro'] },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
})
