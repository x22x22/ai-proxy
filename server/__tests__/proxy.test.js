const {
  parseTargetUrl,
  applyCors,
  createProxy,
} = require('../lib/proxy')

describe('parseTargetUrl', () => {
  test('returns fully qualified URL when valid and encoded', () => {
    const target = parseTargetUrl('/https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1')
    expect(target).toBe('https://example.com/path?a=1')
  })

  test('returns null when protocol is not http or https', () => {
    expect(parseTargetUrl('/ftp://example.com')).toBeNull()
  })

  test('returns null when URL is missing', () => {
    expect(parseTargetUrl('/')).toBeNull()
    expect(parseTargetUrl('')).toBeNull()
  })
})

describe('applyCors', () => {
  const createResponse = () => ({
    setHeader: jest.fn(),
    writeHead: jest.fn(),
    end: jest.fn(),
  })

  test('allows request with matching origin', () => {
    const req = {
      method: 'GET',
      headers: {
        origin: 'https://allowed.com',
      },
    }
    const res = createResponse()

    const allowed = applyCors(req, res, {
      allowAnyOrigin: false,
      allowedOriginSet: new Set(['https://allowed.com']),
    })

    expect(allowed).toBe(true)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://allowed.com'
    )
    expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Origin')
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true'
    )
    expect(res.writeHead).not.toHaveBeenCalled()
    expect(res.end).not.toHaveBeenCalled()
  })

  test('handles preflight OPTIONS request and ends response', () => {
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: 'https://allowed.com',
        'access-control-request-headers': 'X-Test-Header',
      },
    }
    const res = createResponse()

    const allowed = applyCors(req, res, {
      allowAnyOrigin: false,
      allowedOriginSet: new Set(['https://allowed.com']),
    })

    expect(allowed).toBe(false)
    expect(res.writeHead).toHaveBeenCalledWith(204)
    expect(res.end).toHaveBeenCalled()
  })

  test('rejects disallowed origins with 403', () => {
    const req = {
      method: 'GET',
      headers: {
        origin: 'https://blocked.com',
      },
    }
    const res = createResponse()

    const allowed = applyCors(req, res, {
      allowAnyOrigin: false,
      allowedOriginSet: new Set(['https://allowed.com']),
    })

    expect(allowed).toBe(false)
    expect(res.writeHead).toHaveBeenCalledWith(403, {
      'Content-Type': 'text/plain',
    })
    expect(res.end).toHaveBeenCalledWith('Origin not allowed')
  })

  test('sets wildcard header when no origin and any origin is allowed', () => {
    const req = {
      method: 'GET',
      headers: {},
    }
    const res = createResponse()

    const allowed = applyCors(req, res, {
      allowAnyOrigin: true,
    })

    expect(allowed).toBe(true)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*'
    )
  })
})

describe('createProxy', () => {
  test('invokes provided error handler', () => {
    const errorHandler = jest.fn((error, req, res) => {
      if (!res.headersSent) {
        res.headersSent = true
        res.writeHead(502)
      }
      res.end(error.message)
    })

    const proxy = createProxy({ onError: errorHandler })

    const req = {}
    const res = {
      headersSent: false,
      writeHead: jest.fn(),
      end: jest.fn(),
    }

    const error = new Error('boom')
    proxy.emit('error', error, req, res)

    expect(errorHandler).toHaveBeenCalledWith(error, req, res)
  })
})
