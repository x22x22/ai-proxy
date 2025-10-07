import { test as base, chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const USERSCRIPT_FILENAME = 'ai-proxy-redirector.user.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USER_SCRIPT_PATH = path.resolve(__dirname, '../../dist', USERSCRIPT_FILENAME)

export const test = base.extend({
  context: async ({}, use, workerInfo) => {
    await fs.access(USER_SCRIPT_PATH)

    const userDataDir = path.join(workerInfo.project.outputDir, `chromium-profile-${workerInfo.workerIndex}`)
    await fs.rm(userDataDir, { recursive: true, force: true })

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
    })

    await context.addInitScript({ path: USER_SCRIPT_PATH })

    try {
      await use(context)
    } finally {
      await context.close()
    }
  },
  page: async ({ context }, use) => {
    const existing = context.pages()[0] ?? (await context.newPage())
    await use(existing)
  },
})

export { expect } from '@playwright/test'
