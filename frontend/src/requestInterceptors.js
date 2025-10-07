import { createBypassMatcher } from './bypassPatterns'

const FETCH_SYMBOL = Symbol('ai-proxy:original-fetch')
const XHR_OPEN_SYMBOL = Symbol('ai-proxy:original-xhr-open')

function buildProxyBase(settings) {
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

function rewriteUrl(url, settings) {
  const proxyBase = buildProxyBase(settings)
  if (!proxyBase) return url

  const absoluteUrl = toAbsoluteUrl(url)
  const bypassMatcher = createBypassMatcher(settings?.bypassList)

  if (bypassMatcher(absoluteUrl, { proxyBase })) {
    return absoluteUrl
  }

  return `${proxyBase}${absoluteUrl}`
}

function wrapFetch(getSettings) {
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

function wrapXMLHttpRequest(getSettings) {
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

export function installRequestInterceptors(getSettings) {
  if (typeof window === 'undefined') return
  wrapFetch(getSettings)
  wrapXMLHttpRequest(getSettings)
}
