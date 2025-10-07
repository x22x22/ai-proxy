# AI Proxy Reverse Proxy Server

This Node.js service accepts requests that contain the original target URL inside the path (for example,
`/https://example.com/api`) and forwards them using [`http-proxy`](https://www.npmjs.com/package/http-proxy).
It is intended to pair with the Tampermonkey userscript in `../frontend/` that rewrites browser requests to this
format.

## Getting started

```bash
npm install
npm start
```

By default the server listens on `http://0.0.0.0:8787` and accepts requests from any origin.

## Supported environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Interface to bind the HTTP(S) server to. |
| `PORT` | `8787` | Port to listen on. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of origins allowed to call the proxy. Example: `https://app.example.com,https://other.example.com`. Use `*` to allow all. |
| `TLS_KEY_PATH` | _(unset)_ | When provided alongside `TLS_CERT_PATH`, the server starts in HTTPS mode using the given private key. |
| `TLS_CERT_PATH` | _(unset)_ | Certificate file to pair with `TLS_KEY_PATH`. |
| `TLS_CA_PATH` | _(unset)_ | Optional CA bundle to trust when serving HTTPS. |
| `TLS_PASSPHRASE` | _(unset)_ | Passphrase for the TLS private key, if required. |
| `UPSTREAM_REJECT_UNAUTHORIZED` | `true` | Set to `false` to allow proxying to HTTPS targets with self-signed certificates. |

## Request format

Send requests to the proxy server with the original destination URL appended to the path, e.g.

```
GET http://localhost:8787/https://httpbin.org/get
```

The server reconstructs the target (`https://httpbin.org/get`) and forwards the incoming method, headers, and body to
that URL. Responses stream back to the client unchanged.

For CORS preflight (`OPTIONS`) requests, the server automatically answers when the origin matches the
`ALLOWED_ORIGINS` list.
