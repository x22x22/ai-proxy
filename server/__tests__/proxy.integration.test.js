const http = require('http')

const {
  parseTargetUrl,
  applyCors,
  createServer,
  createProxy,
} = require('../lib/proxy')

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address()))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

describe('proxy integration', () => {
  test('forwards requests to the upstream server and returns its response', async () => {
    let resolveUpstreamRequest
    const upstreamRequestPromise = new Promise((resolve) => {
      resolveUpstreamRequest = resolve
    })

    const upstreamResponseBodyForPath = (path) =>
      JSON.stringify({ upstream: true, path })

    const upstreamServer = http.createServer((req, res) => {
      const requestInfo = {
        method: req.method,
        url: req.url,
        headers: req.headers,
      }

      req.on('end', () => {
        resolveUpstreamRequest(requestInfo)
      })
      req.resume()

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Upstream': 'true',
      })
      res.end(upstreamResponseBodyForPath(req.url))
    })

    const upstreamAddress = await listen(upstreamServer)

    const proxy = createProxy({
      onError: (error, req, res) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
        }
        res.end(error.message)
      },
    })

    const proxyServer = createServer((req, res) => {
      const target = parseTargetUrl(req.url)

      if (!target) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Invalid proxy request')
        return
      }

      if (!applyCors(req, res)) {
        return
      }

      const targetUrl = new URL(target)
      if (targetUrl.protocol === 'https:') {
        targetUrl.protocol = 'http:'
      }

      proxy.web(req, res, { target: targetUrl.toString() })
    })

    const proxyAddress = await listen(proxyServer)

    try {
      const responsePromise = new Promise((resolve, reject) => {
        const request = http.request(
          {
            hostname: '127.0.0.1',
            port: proxyAddress.port,
            path: `/https://127.0.0.1:${upstreamAddress.port}/upstream/path?foo=bar`,
            method: 'GET',
            headers: {
              'X-Test-Header': 'integration',
            },
          },
          (res) => {
            const chunks = []
            res.on('data', (chunk) => chunks.push(chunk))
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf8'),
              })
            })
          }
        )

        request.on('error', reject)
        request.end()
      })

      const [response, upstreamRequest] = await Promise.all([
        responsePromise,
        upstreamRequestPromise,
      ])

      expect(upstreamRequest.method).toBe('GET')
      expect(upstreamRequest.url).toBe('/upstream/path?foo=bar')
      expect(upstreamRequest.headers['x-test-header']).toBe('integration')

      expect(response.statusCode).toBe(200)
      expect(response.headers['x-upstream']).toBe('true')
      expect(response.body).toBe(
        upstreamResponseBodyForPath('/upstream/path?foo=bar')
      )
    } finally {
      await Promise.all([close(proxyServer), close(upstreamServer)])
      proxy.close()
    }
  })
})
