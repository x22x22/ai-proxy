const http = require('http')

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
  isOriginAllowed,
} = require('./lib/proxy')

function writeSocketResponse(socket, statusCode, message) {
  if (!socket || typeof socket.write !== 'function') {
    return
  }

  const reason = http.STATUS_CODES[statusCode] || 'Error'
  const body = message || reason
  const payload =
    `HTTP/1.1 ${statusCode} ${reason}\r\n` +
    'Connection: close\r\n' +
    'Content-Type: text/plain\r\n' +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    '\r\n' +
    body

  try {
    socket.write(payload)
  } catch (error) {
    // ignore write errors
  } finally {
    if (typeof socket.destroy === 'function') {
      socket.destroy()
    }
  }
}

const proxy = createProxy({
  changeOrigin: true,
  ws: true,
  onError: (error, req, res) => {
    console.error('[proxy] Failed to forward request:', error.message)
    const message = 'Proxy error: ' + error.message

    if (res && typeof res.writeHead === 'function') {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' })
      }
      res.end(message)
      return
    }

    if (res && typeof res.write === 'function') {
      writeSocketResponse(res, 502, message)
      return
    }

    if (req && req.socket && typeof req.socket.destroy === 'function') {
      req.socket.destroy()
    }
  },
})

const server = createServer((req, res) => {
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return
  }

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

server.on('upgrade', (req, socket, head) => {
  const target = parseTargetUrl(req.url)

  if (!target) {
    writeSocketResponse(
      socket,
      400,
      'Invalid proxy request. Use /https://example.com/path format.'
    )
    return
  }

  if (!isOriginAllowed(req.headers.origin)) {
    writeSocketResponse(socket, 403, 'Origin not allowed')
    return
  }

  proxy.ws(req, socket, head, { target })
})

server.listen(PORT, HOST, () => {
  const protocol = TLS_KEY_PATH && TLS_CERT_PATH ? 'https' : 'http'
  console.log(`[proxy] Listening on ${protocol}://${HOST}:${PORT}`)
  console.log('[proxy] Allowed origins:', allowAnyOrigin ? '* (all origins)' : Array.from(allowedOriginSet).join(', '))
})
