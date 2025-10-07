const {
  HOST,
  PORT,
  TLS_KEY_PATH,
  TLS_CERT_PATH,
  allowAnyOrigin,
  allowedOriginSet,
  parseTargetUrl,
  applyCors,
  createServer,
  createProxy,
} = require('./lib/proxy')

const proxy = createProxy({
  onError: (error, req, res) => {
    console.error('[proxy] Failed to forward request:', error.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
    }
    res.end('Proxy error: ' + error.message)
  },
})

const server = createServer((req, res) => {
  const target = parseTargetUrl(req.url)

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Invalid proxy request. Use /https://example.com/path format.')
    return
  }

  if (!applyCors(req, res)) {
    return
  }

  proxy.web(req, res, { target })
})

server.listen(PORT, HOST, () => {
  const protocol = TLS_KEY_PATH && TLS_CERT_PATH ? 'https' : 'http'
  console.log(`[proxy] Listening on ${protocol}://${HOST}:${PORT}`)
  console.log('[proxy] Allowed origins:', allowAnyOrigin ? '* (all origins)' : Array.from(allowedOriginSet).join(', '))
})
