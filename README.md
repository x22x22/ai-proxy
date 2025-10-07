# AI Proxy Tampermonkey Setup

[![CI](https://github.com/OWNER/ai-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/ai-proxy/actions/workflows/ci.yml)

> 在正式发布前请将上方徽章中的 `OWNER` 更新为实际的 GitHub 组织或用户名；提交代码前务必确保本地测试通过，并使用与流水线一致的 Node.js 20.19.x 环境，以维持持续集成流水线处于绿色状态。

This repository contains two coordinated pieces:

- `frontend/` – a Vue-powered Tampermonkey userscript that rewrites every outbound `fetch`/`XMLHttpRequest` call so
  it flows through a configurable proxy endpoint.
- `server/` – a Node.js reverse proxy that accepts requests at `/protocol://host/...` and forwards them to the
  original destination while preserving method, headers, body, and streaming responses.

Follow the steps below for an end-to-end installation.

## 1. Start the reverse proxy server

```bash
cd server
npm install
npm start
```

The default configuration listens on `http://0.0.0.0:8787` and allows requests from any origin. See
[`server/README.md`](server/README.md) for environment variables that let you bind to a specific interface, enable TLS,
and lock down allowed origins.

## 2. Build the Tampermonkey userscript bundle

In a new terminal:

```bash
cd frontend
npm install
npm run build
```

The build outputs `dist/ai-proxy-redirector.user.js` – this file is the userscript that Tampermonkey will execute.

## 3. Install the userscript in Tampermonkey

1. Open the Tampermonkey dashboard in your browser.
2. Navigate to the **Utilities** tab and use **Import from file** (or simply open the generated `.user.js` file in the
   browser) to install `dist/ai-proxy-redirector.user.js`.
3. Confirm the permissions (the script matches all pages and stores configuration) and complete the installation.

## 4. Configure the proxy endpoint from the page UI

- Load any page where you want requests to be proxied.
- Click the floating **Open proxy settings** pill (or press **Shift + P**) to reveal the settings panel.
- Enter the protocol (`http` or `https`), host, and port that point to your running proxy server. The default
  configuration expects `http://localhost:8787`.
- Close the panel – settings persist automatically via Tampermonkey storage.
- 在同一面板中可以维护「绕过列表」，用于标记不应通过代理重写的请求。例如可输入域名片段
  （如 `internal.service`）、通配符模式（如 `*.internal`）或使用 `/pattern/flags` 形式的正则表达式
  （如 `^https://api.example.com$`）。每行代表一条规则，可通过 **添加** 按钮或按下回车将输入保存，
  点击规则旁的删除图标即可移除。
- 绕过列表适合保留局域网接口、健康检查或已经通过其他手段保护的服务直连。被匹配到的请求将
  原样发送，不再经过代理，方便逐步迁移或排查问题。

## 5. Verify request redirection

With the userscript enabled and the proxy server running:

1. Open your browser’s developer tools and switch to the **Network** tab.
2. Trigger a `fetch` or XHR request on the page (for example, run `fetch('https://httpbin.org/get')` in the console).
3. Observe that the request URL in the network log now points to `http://<proxy-host>:<proxy-port>/<original URL>` and
   that the response arrives successfully via the proxy.

If requests fail, double-check that the proxy server is reachable from the browser and that the origin you are testing
from is present in the server’s `ALLOWED_ORIGINS` list.
