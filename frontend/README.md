# AI Proxy Redirector Userscript

This package bundles a Vue-powered Tampermonkey userscript that reroutes every `fetch` and `XMLHttpRequest`
request through a configurable reverse proxy. The UI ships as an overlay panel rendered by Vue and persists
its configuration via Tampermonkey storage (with a `localStorage` fallback for local development).

## Prerequisites

- Node.js 18+
- npm 9+

## Development

```bash
npm install
npm run dev
```

The dev server mounts the userscript UI at `http://localhost:5173`. While running in the browser you can open
and close the settings panel via **Shift + P**.

## Testing

```bash
npm run test
```

The Vitest suite covers the proxy URL 重写逻辑以及针对 `fetch`/`XMLHttpRequest` 包装器的行为。

## Building the userscript bundle

```bash
npm run build
```

The build emits `dist/ai-proxy-redirector.user.js`, which is the Tampermonkey-compatible script bundle.

## Installing in Tampermonkey

1. Run `npm run build`.
2. Open the generated `dist/ai-proxy-redirector.user.js` file in your browser or drag it into Tampermonkey's
   "Utilities" tab and choose **Import**.
3. Review the metadata (the script matches all URLs and requests storage permissions) and click **Install**.
4. Reload any target pages where you want request proxying to occur.

## Configuring the proxy endpoint

- Click the floating **Open proxy settings** pill or press **Shift + P** to toggle the settings panel.
- Provide the proxy protocol (`http` or `https`), host, and port. The userscript immediately persists the
  configuration via `GM_setValue` so it will be reused on future page loads.
- The preview string in the panel shows how outgoing requests will be rewritten, e.g.
  `https://proxy.example.com:8787/https://original-target.com/api`.
- 在同一面板内可以维护「绕过匹配规则」，用于将特定请求排除在代理之外。支持输入普通字符串
  （如 `internal.service`）、通配符模式（如 `*.internal`）或 `/pattern/flags` 形式的正则表达式（如
  `^https://api.example.com$`）。每条规则占一行，可通过 **添加** 按钮或回车保存，点选对应的删除按钮
  即可移除。被匹配到的请求会直接发往原目标。
- 预览字符串会在末尾追加绕过规则的摘要，帮助你确认哪些主机或路径会被保留为直连。

You can reset to the default (`http://localhost:8787`) at any time via the **Reset to defaults** button in the
panel.
