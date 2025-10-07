import { reactive, watch } from 'vue'

const STORAGE_KEY = 'ai-proxy.redirector-settings'

export const DEFAULT_PROXY_SETTINGS = Object.freeze({
  protocol: 'http',
  host: 'localhost',
  port: '8787',
  bypassPatterns: [],
})

function getStorageValue() {
  if (typeof GM_getValue === 'function') {
    return GM_getValue(STORAGE_KEY, null)
  }
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[ai-proxy] Unable to read settings from localStorage', error)
    return null
  }
}

function setStorageValue(value) {
  if (typeof GM_setValue === 'function') {
    GM_setValue(STORAGE_KEY, value)
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch (error) {
    console.warn('[ai-proxy] Unable to persist settings to localStorage', error)
  }
}

function parseSettings(rawValue) {
  if (!rawValue) {
    return {
      ...DEFAULT_PROXY_SETTINGS,
      bypassPatterns: [...DEFAULT_PROXY_SETTINGS.bypassPatterns],
    }
  }

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    const bypassPatterns = Array.isArray(parsed?.bypassPatterns)
      ? parsed.bypassPatterns
      : DEFAULT_PROXY_SETTINGS.bypassPatterns

    return {
      ...DEFAULT_PROXY_SETTINGS,
      ...parsed,
      bypassPatterns: normaliseBypassPatterns(bypassPatterns),
    }
  } catch (error) {
    console.warn('[ai-proxy] Unable to parse stored settings, falling back to defaults', error)
    return {
      ...DEFAULT_PROXY_SETTINGS,
      bypassPatterns: [...DEFAULT_PROXY_SETTINGS.bypassPatterns],
    }
  }
}

function normaliseProtocol(protocol) {
  if (!protocol) return DEFAULT_PROXY_SETTINGS.protocol
  return protocol.replace(/:\s*$/, '').replace(/[^a-zA-Z0-9+.-]/g, '').toLowerCase() || DEFAULT_PROXY_SETTINGS.protocol
}

function normaliseHost(host) {
  if (!host) return ''
  return host.trim()
}

function normalisePort(port) {
  if (!port && port !== 0) return ''
  const asString = String(port).trim()
  if (asString === '') return ''
  return asString.replace(/[^0-9]/g, '')
}

function normaliseBypassPatterns(patterns) {
  if (!Array.isArray(patterns)) return []

  const seen = new Set()
  const result = []

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue
    const trimmed = pattern.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

let state

export function useProxySettings() {
  if (!state) {
    const initial = parseSettings(getStorageValue())
    state = reactive({
      ...initial,
      bypassPatterns: [...initial.bypassPatterns],
    })

    watch(
      state,
      (value) => {
        const bypassPatterns = normaliseBypassPatterns(value.bypassPatterns)
        const serialised = JSON.stringify({
          protocol: normaliseProtocol(value.protocol),
          host: normaliseHost(value.host),
          port: normalisePort(value.port),
          bypassPatterns,
        })
        setStorageValue(serialised)
      },
      { deep: true }
    )
  }

  return state
}

export function getProxySettingsSnapshot() {
  const current = state ?? parseSettings(getStorageValue())
  return {
    protocol: normaliseProtocol(current.protocol),
    host: normaliseHost(current.host),
    port: normalisePort(current.port),
    bypassPatterns: normaliseBypassPatterns(current.bypassPatterns),
  }
}

export function resetProxySettings() {
  if (!state) {
    state = reactive({
      ...DEFAULT_PROXY_SETTINGS,
      bypassPatterns: [...DEFAULT_PROXY_SETTINGS.bypassPatterns],
    })
    return state
  }
  state.protocol = DEFAULT_PROXY_SETTINGS.protocol
  state.host = DEFAULT_PROXY_SETTINGS.host
  state.port = DEFAULT_PROXY_SETTINGS.port
  state.bypassPatterns = [...DEFAULT_PROXY_SETTINGS.bypassPatterns]
  return state
}
