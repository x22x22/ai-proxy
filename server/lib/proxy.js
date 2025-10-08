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

function resolveOriginPolicy(overrides = {}) {
  const allowAny =
    typeof overrides.allowAnyOrigin === 'boolean'
      ? overrides.allowAnyOrigin
      : allowAnyOrigin
  const originSet = overrides.allowedOriginSet || allowedOriginSet

  return { allowAny, originSet }
}

function isOriginAllowed(origin, overrides = {}) {
  const { allowAny, originSet } = resolveOriginPolicy(overrides)

  if (!origin) {
    return true
  }

  if (allowAny) {
    return true
  }

  return originSet.has(origin)
}

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

  if (!/^(https?|wss?):\/\//i.test(decoded)) {
    return null
  }

  try {
    const url = new URL(decoded)
    return url.toString()
  } catch (error) {
    return null
  }
}

function applyCors(req, res, overrides = {}) {
  const { allowAny, originSet } = resolveOriginPolicy(overrides)

  const origin = req.headers.origin

  if (!origin) {
    if (allowAny) {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    return true
  }

  if (isOriginAllowed(origin, { allowAnyOrigin: allowAny, allowedOriginSet: originSet })) {
    res.setHeader('Access-Control-Allow-Origin', allowAny ? '*' : origin)
    res.setHeader('Vary', 'Origin')
    if (!allowAny) {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.headers['access-control-request-headers']) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers']
      )
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD'
    )

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

function createProxy(options = {}) {
  const { onError, ...proxyOptions } = options
  const proxy = httpProxy.createProxyServer({
    ignorePath: true,
    secure: STRICT_TLS,
    ...proxyOptions,
  })

  if (typeof onError === 'function') {
    proxy.on('error', onError)
  }

  return proxy
}

module.exports = {
  HOST,
  PORT,
  TLS_KEY_PATH,
  TLS_CERT_PATH,
  TLS_CA_PATH,
  TLS_PASSPHRASE,
  ALLOWED_ORIGINS,
  STRICT_TLS,
  allowAnyOrigin,
  allowedOriginSet,
  parseTargetUrl,
  applyCors,
  createServer,
  createProxy,
  resolveOriginPolicy,
  isOriginAllowed,
}
