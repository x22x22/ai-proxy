import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { getProxySettingsSnapshot, useProxySettings } from './proxySettings'
import { installRequestInterceptors } from './requestInterceptors'
import { OPEN_SETTINGS_EVENT } from './events'

const settings = useProxySettings()

installRequestInterceptors(() => getProxySettingsSnapshot())

const containerId = 'ai-proxy-redirector-root'

if (typeof GM_registerMenuCommand === 'function') {
  GM_registerMenuCommand('打开代理设置', () => {
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT))
  })
}

function mountApp() {
  let mountPoint = document.getElementById(containerId)

  if (!mountPoint) {
    mountPoint = document.createElement('div')
    mountPoint.id = containerId
    const target = document.body || document.documentElement
    target.appendChild(mountPoint)
  }

  const app = createApp(App)
  app.provide('proxySettings', settings)
  app.mount(mountPoint)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true })
} else {
  mountApp()
}
