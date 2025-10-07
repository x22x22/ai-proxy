import http from 'node:http'
import type { AddressInfo } from 'node:net'

import type { Route } from '@playwright/test'

import { expect, test } from './fixtures'

const DEMO_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Proxy rewrite demo</title>
  </head>
  <body>
    <h1>Proxy rewrite demo</h1>
    <button id="fetch-btn" type="button">Trigger fetch</button>
    <pre id="response-log">(awaiting request)</pre>
    <script>
      window.__fetchCount = 0
      const button = document.getElementById('fetch-btn')
      const log = document.getElementById('response-log')

      async function triggerFetch() {
        const step = ++window.__fetchCount
        log.textContent = 'pending request #' + step
        try {
          const response = await fetch('https://api.example.com/data?step=' + step)
          const text = await response.text()
          log.textContent = text
        } catch (error) {
          log.textContent = 'error: ' + error
        }
      }

      button.addEventListener('click', triggerFetch)
    </script>
  </body>
</html>`

let server: http.Server
let baseUrl = ''

test.beforeAll(async () => {
  server = await new Promise((resolve) => {
    const created = http.createServer((req, res) => {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
      })
      res.end(DEMO_HTML)
    })
    created.listen(0, '127.0.0.1', () => resolve(created))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}/`
})

test.afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve(undefined)
    })
  })
})

test('rewrites fetches by default and bypasses when configured', async ({ page }) => {
  await page.goto(baseUrl)

  await expect(page.getByRole('button', { name: /Open proxy settings/ })).toBeVisible()

  let resolveProxiedRequest: ((url: string) => void) | undefined
  const proxiedRequest = new Promise<string>((resolve) => {
    resolveProxiedRequest = resolve
  })
  const proxiedHandler = async (route: Route) => {
    const requestUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ via: 'proxy', url: requestUrl }),
    })
    resolveProxiedRequest?.(requestUrl)
  }
  await page.route('http://localhost:8787/**', proxiedHandler)

  await page.getByRole('button', { name: 'Trigger fetch' }).click()

  const proxiedUrl = await proxiedRequest
  expect(proxiedUrl).toContain('http://localhost:8787/https://api.example.com/data?step=1')
  await expect(page.locator('#response-log')).toHaveText(
    /"via":"proxy"/
  )

  await page.unroute('http://localhost:8787/**', proxiedHandler)

  await page.getByRole('button', { name: /Open proxy settings/ }).click()
  await page.getByPlaceholder('添加新的绕过规则').fill('api.example.com')
  await page.getByRole('button', { name: '添加' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  let proxiedTriggered = false
  const guardHandler = async (route: Route) => {
    proxiedTriggered = true
    await route.abort()
  }
  await page.route('http://localhost:8787/**', guardHandler)

  let resolveDirectRequest: ((url: string) => void) | undefined
  const directRequest = new Promise<string>((resolve) => {
    resolveDirectRequest = resolve
  })
  const directHandler = async (route: Route) => {
    const requestUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ via: 'direct', url: requestUrl }),
    })
    resolveDirectRequest?.(requestUrl)
  }
  await page.route('https://api.example.com/**', directHandler)

  await page.getByRole('button', { name: 'Trigger fetch' }).click()

  const directUrl = await directRequest
  expect(directUrl).toContain('https://api.example.com/data?step=2')
  await expect(page.locator('#response-log')).toHaveText(/"via":"direct"/)
  expect(proxiedTriggered).toBe(false)

  await page.unroute('http://localhost:8787/**', guardHandler)

  await page.unroute('https://api.example.com/**', directHandler)
})
