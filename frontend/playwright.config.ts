import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: path.resolve(__dirname, 'tests/e2e/global-setup.ts'),
  use: {
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        channel: 'chromium',
      },
    },
  ],
})
