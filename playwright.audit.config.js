import { defineConfig, devices } from '@playwright/test'

// Config separada para auditoría visual (screenshots). Hereda los projects
// y webServer del config principal pero apunta a tests/audit/ en lugar de
// tests/e2e/. Se invoca con `npm run test:audit`.
export default defineConfig({
  testDir: './tests/audit',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 60_000,
    reuseExistingServer: true,
  },
})
