import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildProxyBase,
  rewriteUrl,
  shouldBypass,
  wrapFetch,
  wrapXMLHttpRequest,
} from './requestInterceptors'

if (typeof window === 'undefined') {
  global.window = globalThis
}

const ORIGINAL_LOCATION_DESCRIPTOR = Object.getOwnPropertyDescriptor(global, 'location')
const ORIGINAL_LOCATION_VALUE = global.location
const REAL_FETCH = typeof window !== 'undefined' ? window.fetch : undefined
const REAL_XML_HTTP_REQUEST = global.XMLHttpRequest

function withCustomLocation(href, fn) {
  Object.defineProperty(global, 'location', {
    value: { href },
    configurable: true,
    enumerable: true,
    writable: true,
  })

  try {
    return fn()
  } finally {
    if (ORIGINAL_LOCATION_DESCRIPTOR) {
      Object.defineProperty(global, 'location', ORIGINAL_LOCATION_DESCRIPTOR)
    } else if (ORIGINAL_LOCATION_VALUE !== undefined) {
      global.location = ORIGINAL_LOCATION_VALUE
    } else {
      delete global.location
    }
  }
}

describe('buildProxyBase', () => {
  it('使用默认协议和端口构建代理地址', () => {
    expect(buildProxyBase({ host: 'proxy.local' })).toBe('http://proxy.local/')
  })

  it('尊重自定义协议和端口', () => {
    expect(buildProxyBase({ protocol: 'https', host: 'proxy.local', port: 8443 })).toBe(
      'https://proxy.local:8443/'
    )
  })

  it('当未配置主机时返回 null', () => {
    expect(buildProxyBase({})).toBeNull()
  })
})

describe('rewriteUrl 与 bypass 逻辑', () => {
  const settings = { protocol: 'https', host: 'proxy.local' }
  const proxyBase = buildProxyBase(settings)

  it('为普通请求拼接代理前缀', () => {
    expect(rewriteUrl('http://api.example.com/data', settings)).toBe(
      `${proxyBase}http://api.example.com/data`
    )
  })

  it('处理带端口的目标地址', () => {
    const custom = { protocol: 'http', host: 'proxy.local', port: 3000 }
    expect(rewriteUrl('https://service.dev:9000/v1', custom)).toBe(
      `${buildProxyBase(custom)}https://service.dev:9000/v1`
    )
  })

  it('能够处理相对路径', () => {
    withCustomLocation('https://app.example.com/dashboard', () => {
      expect(rewriteUrl('/api/session', { host: 'proxy.local' })).toBe(
        'http://proxy.local/https://app.example.com/api/session'
      )
    })
  })

  it('对已经代理过的请求保持不变', () => {
    const proxied = `${proxyBase}https://service.example.com/graphql`
    expect(shouldBypass(proxied, proxyBase)).toBe(true)
    expect(rewriteUrl(proxied, settings)).toBe(proxied)
  })

  it('当 URL 匹配绕过字符串时返回原始地址', () => {
    const bypassSettings = { ...settings, bypassPatterns: ['service.example.com'] }
    const target = 'https://service.example.com/api'
    expect(rewriteUrl(target, bypassSettings)).toBe(target)
  })

  it('当 URL 匹配绕过正则时返回原始地址', () => {
    const bypassSettings = { ...settings, bypassPatterns: ['/\\/v1\\/health/i'] }
    const target = 'https://service.dev/v1/health'
    expect(rewriteUrl(target, bypassSettings)).toBe(target)
  })

  it('在无效正则后仍可继续匹配其它规则', () => {
    const bypassSettings = {
      ...settings,
      bypassPatterns: ['/invalid/[', 'service.example.com'],
    }
    const target = 'https://service.example.com/api'
    expect(rewriteUrl(target, bypassSettings)).toBe(target)
  })
})

describe('wrapFetch', () => {
  let originalFetch

  beforeEach(() => {
    vi.restoreAllMocks()
    originalFetch = vi.fn((...args) => Promise.resolve(args))
    window.fetch = originalFetch
  })

  afterEach(() => {
    if (REAL_FETCH) {
      window.fetch = REAL_FETCH
    } else {
      delete window.fetch
    }
  })

  it('在未配置代理主机时保持请求原样', async () => {
    wrapFetch(() => ({}))

    await window.fetch('https://example.com/data', { method: 'GET' })

    expect(originalFetch).toHaveBeenCalledTimes(1)
    expect(originalFetch.mock.calls[0][0]).toBe('https://example.com/data')
    expect(originalFetch.mock.calls[0][1]).toEqual({ method: 'GET' })
  })

  it('在配置代理后只重写一次', async () => {
    const settings = { protocol: 'https', host: 'proxy.local' }

    wrapFetch(() => settings)

    await window.fetch('http://upstream.local/api')
    expect(originalFetch).toHaveBeenCalledTimes(1)
    const firstRequest = originalFetch.mock.calls[0][0]
    expect(firstRequest).toBeInstanceOf(Request)
    expect(firstRequest.url).toBe('https://proxy.local/http://upstream.local/api')

    originalFetch.mockClear()
    await window.fetch('https://proxy.local/http://upstream.local/api')
    expect(originalFetch).toHaveBeenCalledTimes(1)
    const secondRequest = originalFetch.mock.calls[0][0]
    expect(secondRequest.url).toBe('https://proxy.local/http://upstream.local/api')
  })

  it('在匹配绕过规则时透传请求', async () => {
    const settings = { protocol: 'https', host: 'proxy.local', bypassPatterns: ['upstream.local'] }

    wrapFetch(() => settings)

    await window.fetch('http://upstream.local/api')
    expect(originalFetch).toHaveBeenCalledTimes(1)
    const firstRequest = originalFetch.mock.calls[0][0]
    expect(firstRequest).toBeInstanceOf(Request)
    expect(firstRequest.url).toBe('http://upstream.local/api')
  })
})

describe('wrapXMLHttpRequest', () => {
  let MockXHR
  let openSpy

  beforeEach(() => {
    vi.restoreAllMocks()
    openSpy = vi.fn()
    MockXHR = function () {}
    MockXHR.prototype.open = openSpy
    global.XMLHttpRequest = MockXHR
  })

  afterEach(() => {
    if (REAL_XML_HTTP_REQUEST) {
      global.XMLHttpRequest = REAL_XML_HTTP_REQUEST
    } else {
      delete global.XMLHttpRequest
    }
  })

  it('在未配置代理时直接透传 URL', () => {
    wrapXMLHttpRequest(() => ({}))

    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'https://service.example/data')

    expect(openSpy).toHaveBeenCalledWith('GET', 'https://service.example/data')
  })

  it('在配置代理后只重写一次', () => {
    const settings = { protocol: 'https', host: 'proxy.local' }
    wrapXMLHttpRequest(() => settings)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://upstream.local/api')
    expect(openSpy).toHaveBeenCalledWith('POST', 'https://proxy.local/http://upstream.local/api')

    openSpy.mockClear()
    xhr.open('POST', 'https://proxy.local/http://upstream.local/api')
    expect(openSpy).toHaveBeenCalledWith('POST', 'https://proxy.local/http://upstream.local/api')
  })

  it('在匹配绕过规则时保持原始 URL', () => {
    const settings = {
      protocol: 'https',
      host: 'proxy.local',
      bypassPatterns: ['/upstream\\.local/i'],
    }
    wrapXMLHttpRequest(() => settings)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://UPSTREAM.local/api')
    expect(openSpy).toHaveBeenCalledWith('POST', 'http://UPSTREAM.local/api')
  })
})
