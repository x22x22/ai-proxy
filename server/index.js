const fs = require('fs')
const http = require('http')
const https = require('https')
const httpProxy = require('http-proxy')

const HOST = process.env.HOST || '0.0.0.0'
const PORT = parseInt(process.env.PORT || '8787', 10)
const TLS_KEY_PATH = process.env.TLS_KEY_PATH
const TLS_CERT_PATH = process.env.TLS_CERT_PATH
const TLS_CA_PATH = process.env.TLS_CA_PATH
const TLS_PASSPHRASE = process.env.TLS_PASSPHRASE
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const STRICT_TLS = process.env.UPSTREAM_REJECT_UNAUTHORIZED !== 'false'

const allowedOriginSet = new Set(ALLOWED_ORIGINS)
const allowAnyOrigin = allowedOriginSet.has('*')

const proxy = httpProxy.createProxyServer({
  ignorePath: true,
  secure: STRICT_TLS,
})

proxy.on('error', (error, req, res) => {
  console.error('[proxy] Failed to forward request:', error.message)
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
  }
  res.end('Proxy error: ' + error.message)
})

function parseTargetUrl(requestUrl = '') {
  if (!requestUrl || requestUrl === '/') {
    return null
  }

  const trimmed = requestUrl.startsWith('/') ? requestUrl.slice(1) : requestUrl

  let decoded
  try {
    decoded = decodeURIComponent(trimmed)
  } catch (error) {
    decoded = trimmed
  }

  if (!/^https?:\/\//i.test(decoded)) {
    return null
  }

  try {
    const url = new URL(decoded)
    return url.toString()
  } catch (error) {
    return null
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin

  if (!origin) {
    if (allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    return true
  }

  if (allowAnyOrigin || allowedOriginSet.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', allowAnyOrigin ? '*' : origin)
    res.setHeader('Vary', 'Origin')
    if (!allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.headers['access-control-request-headers']) {
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return false
    }

    return true
  }

  res.writeHead(403, { 'Content-Type': 'text/plain' })
  res.end('Origin not allowed')
  return false
}

function createServer(handler) {
  if (TLS_KEY_PATH && TLS_CERT_PATH) {
    const options = {
      key: fs.readFileSync(TLS_KEY_PATH),
      cert: fs.readFileSync(TLS_CERT_PATH),
    }

    if (TLS_CA_PATH) {
      options.ca = fs.readFileSync(TLS_CA_PATH)
    }

    if (TLS_PASSPHRASE) {
      options.passphrase = TLS_PASSPHRASE
    }

    return https.createServer(options, handler)
  }

  return http.createServer(handler)
}

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
