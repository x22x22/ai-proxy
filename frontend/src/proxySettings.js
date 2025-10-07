import { reactive, watch } from 'vue'

const STORAGE_KEY = 'ai-proxy.redirector-settings'

export const DEFAULT_PROXY_SETTINGS = Object.freeze({
  protocol: 'http',
  host: 'localhost',
  port: '8787',
  bypassList: [],
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
      bypassList: [...DEFAULT_PROXY_SETTINGS.bypassList],
    }
  }

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    return {
      ...DEFAULT_PROXY_SETTINGS,
      ...parsed,
      bypassList: normaliseBypassList(parsed?.bypassList ?? parsed?.bypassPatterns),
    }
  } catch (error) {
    console.warn('[ai-proxy] Unable to parse stored settings, falling back to defaults', error)
    return {
      ...DEFAULT_PROXY_SETTINGS,
      bypassList: [...DEFAULT_PROXY_SETTINGS.bypassList],
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

function normaliseBypassList(list) {
  if (!list) return []

  const entries = Array.isArray(list) ? list : [list]
  const seen = new Set()
  const normalised = []

  for (const entry of entries) {
    if (entry == null) continue
    const value = String(entry).trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalised.push(value)
  }

  return normalised
}

let state

export function useProxySettings() {
  if (!state) {
    const initial = parseSettings(getStorageValue())
    state = reactive({
      ...initial,
      bypassList: [...(initial.bypassList ?? [])],
    })

    watch(
      state,
      (value) => {
        const bypassList = normaliseBypassList(value.bypassList)
        const currentList = Array.isArray(value.bypassList) ? value.bypassList : []
        const listsDiffer =
          currentList.length !== bypassList.length ||
          currentList.some((entry, index) => entry !== bypassList[index])

        if (listsDiffer || currentList !== value.bypassList) {
          state.bypassList = [...bypassList]
        }
        const serialised = JSON.stringify({
          protocol: normaliseProtocol(value.protocol),
          host: normaliseHost(value.host),
          port: normalisePort(value.port),
          bypassList,
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
    bypassList: normaliseBypassList(current.bypassList),
  }
}

export function resetProxySettings() {
  if (!state) {
    state = reactive({
      ...DEFAULT_PROXY_SETTINGS,
      bypassList: [...DEFAULT_PROXY_SETTINGS.bypassList],
    })
    return state
  }
  state.protocol = DEFAULT_PROXY_SETTINGS.protocol
  state.host = DEFAULT_PROXY_SETTINGS.host
  state.port = DEFAULT_PROXY_SETTINGS.port
  state.bypassList = [...DEFAULT_PROXY_SETTINGS.bypassList]
  return state
}
