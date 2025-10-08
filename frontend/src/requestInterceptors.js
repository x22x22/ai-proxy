const FETCH_SYMBOL = Symbol('ai-proxy:original-fetch')
const XHR_OPEN_SYMBOL = Symbol('ai-proxy:original-xhr-open')
const ES_SYMBOL = Symbol('ai-proxy:original-eventsource')

export function buildProxyBase(settings) {
  const { protocol, host, port } = settings
  if (!host) return null
  const trimmedHost = host.replace(/\/$/, '')
  const portSegment = port ? `:${port}` : ''
  return `${protocol || 'http'}://${trimmedHost}${portSegment}/`
}

function toAbsoluteUrl(input) {
  try {
    const url = new URL(input, typeof location !== 'undefined' ? location.href : undefined)
    return url.toString()
  } catch (error) {
    console.warn('[ai-proxy] Unable to resolve request URL', input, error)
    return input
  }
}

function matchesBypassPattern(url, pattern) {
  if (typeof url !== 'string' || typeof pattern !== 'string') return false

  const trimmed = pattern.trim()
  if (!trimmed) return false

  if (trimmed.startsWith('/') && trimmed.length > 1) {
    const lastSlashIndex = trimmed.lastIndexOf('/')

    if (lastSlashIndex > 0) {
      const patternBody = trimmed.slice(1, lastSlashIndex)
      const flags = trimmed.slice(lastSlashIndex + 1)

      try {
        const regex = new RegExp(patternBody, flags)
        return regex.test(url)
      } catch (error) {
        console.warn('[ai-proxy] Invalid bypass regex pattern, ignoring', trimmed, error)
      }
    }
  }

  return url.includes(trimmed)
}

export function shouldBypass(url, proxyBase, settings) {
  if (typeof url !== 'string') return false

  if (proxyBase && url.startsWith(proxyBase)) {
    return true
  }

  const patterns = settings?.bypassPatterns
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false
  }

  for (const pattern of patterns) {
    if (matchesBypassPattern(url, pattern)) {
      return true
    }
  }

  return false
}

export function rewriteUrl(url, settings) {
  const proxyBase = buildProxyBase(settings)
  if (!proxyBase) return url

  const absoluteUrl = toAbsoluteUrl(url)
  if (shouldBypass(absoluteUrl, proxyBase, settings)) {
    return typeof url === 'string' ? url : absoluteUrl
  }

  return `${proxyBase}${absoluteUrl}`
}

export function wrapFetch(getSettings) {
  if (typeof window === 'undefined' || !window.fetch || window.fetch[FETCH_SYMBOL]) {
    return
  }

  const originalFetch = window.fetch.bind(window)

  const patchedFetch = async (input, init) => {
    const settings = getSettings()

    if (!settings?.host) {
      return originalFetch(input, init)
    }

    let request
    if (input instanceof Request) {
      request = init ? new Request(input, init) : input
    } else {
      const requestUrl = input instanceof URL ? input.href : input
      request = new Request(requestUrl, init)
    }

    const rewrittenUrl = rewriteUrl(request.url, settings)

    if (rewrittenUrl === request.url) {
      return originalFetch(request)
    }

    const proxiedRequest = new Request(rewrittenUrl, request)
    return originalFetch(proxiedRequest)
  }

  patchedFetch[FETCH_SYMBOL] = originalFetch
  window.fetch = patchedFetch
}

export function wrapXMLHttpRequest(getSettings) {
  if (typeof XMLHttpRequest === 'undefined') return
  if (XMLHttpRequest.prototype.open && !XMLHttpRequest.prototype.open[XHR_OPEN_SYMBOL]) {
    const originalOpen = XMLHttpRequest.prototype.open

    const patchedOpen = function (...args) {
      const settings = getSettings()
      if (settings?.host && args.length >= 2) {
        const url = args[1]
        const rewritten = rewriteUrl(url, settings)
        args[1] = rewritten
      }

      return originalOpen.apply(this, args)
    }

    patchedOpen[XHR_OPEN_SYMBOL] = originalOpen
    XMLHttpRequest.prototype.open = patchedOpen
  }
}

export function wrapEventSource(getSettings) {
  if (typeof window === 'undefined') return

  const OriginalEventSource = window.EventSource
  if (!OriginalEventSource || OriginalEventSource[ES_SYMBOL]) {
    return
  }

  const ProxiedEventSource = function (url, eventSourceInitDict) {
    const settings = getSettings()

    if (!settings?.host) {
      return new OriginalEventSource(url, eventSourceInitDict)
    }

    const normalisedUrl =
      url instanceof URL ? url.href : typeof url === 'string' ? url : String(url ?? '')
    const rewritten = rewriteUrl(normalisedUrl, settings)

    return new OriginalEventSource(rewritten, eventSourceInitDict)
  }

  for (const key of Reflect.ownKeys(OriginalEventSource)) {
    if (key === 'prototype' || key === 'length' || key === 'name') continue
    const descriptor = Object.getOwnPropertyDescriptor(OriginalEventSource, key)
    if (descriptor) {
      Object.defineProperty(ProxiedEventSource, key, descriptor)
    }
  }

  Object.setPrototypeOf(ProxiedEventSource, OriginalEventSource)
  ProxiedEventSource.prototype = OriginalEventSource.prototype

  ProxiedEventSource[ES_SYMBOL] = OriginalEventSource

  window.EventSource = ProxiedEventSource
}

export function installRequestInterceptors(getSettings) {
  if (typeof window === 'undefined') return
  wrapFetch(getSettings)
  wrapXMLHttpRequest(getSettings)
  wrapEventSource(getSettings)
}
