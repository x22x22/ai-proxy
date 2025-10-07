const REGEX_PATTERN = /^\/(.*)\/([a-z]*)$/i

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value == null) {
    return []
  }

  const asString = String(value)
  if (!asString.trim()) {
    return []
  }

  if (/[\n,]/.test(asString)) {
    return asString
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return [asString]
}

export function normaliseBypassList(input) {
  const entries = toArray(input)
  const seen = new Set()
  const result = []

  for (const entry of entries) {
    const trimmed = typeof entry === 'string' ? entry.trim() : String(entry).trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

function compileRegex(pattern) {
  const match = pattern.match(REGEX_PATTERN)
  if (!match) return null

  const [, body, flags] = match

  try {
    return new RegExp(body, flags)
  } catch (error) {
    console.warn('[ai-proxy] Invalid bypass regex pattern skipped', pattern, error)
    return null
  }
}

function compileWildcard(pattern) {
  const escaped = pattern.split('*').map((segment) => escapeForRegex(segment)).join('.*')

  try {
    const wildcardRegex = new RegExp(`^${escaped}$`, 'i')
    return (url) => {
      try {
        const parsed = new URL(url)
        return wildcardRegex.test(parsed.hostname) || wildcardRegex.test(parsed.host)
      } catch (error) {
        return false
      }
    }
  } catch (error) {
    console.warn('[ai-proxy] Invalid wildcard bypass pattern skipped', pattern, error)
    return null
  }
}

function compileHostPath(pattern) {
  const lowered = pattern.toLowerCase()
  return (url) => url.toLowerCase().includes(lowered)
}

function compileHostPort(pattern) {
  const lowered = pattern.toLowerCase()
  return (url) => {
    try {
      return new URL(url).host.toLowerCase() === lowered
    } catch (error) {
      return false
    }
  }
}

function compileHostname(pattern) {
  const lowered = pattern.toLowerCase()
  return (url) => {
    try {
      const { hostname } = new URL(url)
      const target = hostname.toLowerCase()
      return target === lowered || target.endsWith(`.${lowered}`)
    } catch (error) {
      return false
    }
  }
}

function compileSchemeUrl(pattern) {
  const lowered = pattern.toLowerCase()
  return (url) => url.toLowerCase().startsWith(lowered)
}

function compilePattern(pattern) {
  if (!pattern) return null
  const trimmed = pattern.trim()
  if (!trimmed) return null

  const regex = compileRegex(trimmed)
  if (regex) {
    return (url) => regex.test(url)
  }

  if (trimmed.includes('://')) {
    return compileSchemeUrl(trimmed)
  }

  if (trimmed.includes('*')) {
    return compileWildcard(trimmed)
  }

  if (trimmed.includes('/')) {
    return compileHostPath(trimmed)
  }

  if (trimmed.includes(':')) {
    return compileHostPort(trimmed)
  }

  return compileHostname(trimmed)
}

export function createBypassMatcher(patterns) {
  const list = normaliseBypassList(patterns)
  const compiled = list
    .map((pattern) => compilePattern(pattern))
    .filter((fn) => typeof fn === 'function')

  return (url, { proxyBase } = {}) => {
    if (typeof url !== 'string' || !url) {
      return false
    }

    if (proxyBase && url.startsWith(proxyBase)) {
      return true
    }

    if (!compiled.length) {
      return false
    }

    for (const matcher of compiled) {
      try {
        if (matcher(url)) {
          return true
        }
      } catch (error) {
        console.warn('[ai-proxy] Error while evaluating bypass pattern', error)
      }
    }

    return false
  }
}
