import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { getProxySettingsSnapshot, useProxySettings } from './proxySettings'
import { installRequestInterceptors } from './requestInterceptors'

const settings = useProxySettings()

installRequestInterceptors(() => getProxySettingsSnapshot())

const containerId = 'ai-proxy-redirector-root'

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
