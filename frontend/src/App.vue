<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { DEFAULT_PROXY_SETTINGS, resetProxySettings } from './proxySettings'

const proxySettings = inject('proxySettings')
const panelOpen = ref(false)

const previewUrl = computed(() => {
  const protocol = proxySettings.protocol || DEFAULT_PROXY_SETTINGS.protocol
  const host = proxySettings.host || '<proxy-host>'
  const port = proxySettings.port ? `:${proxySettings.port}` : ':<proxy-port>'
  return `${protocol}://${host}${port}/https://example.com/path`
})

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function closePanel() {
  panelOpen.value = false
}

function resetToDefaults() {
  resetProxySettings()
}

onMounted(() => {
  window.addEventListener('keydown', (event) => {
    if (event.key?.toLowerCase() === 'p' && event.shiftKey) {
      event.preventDefault()
      togglePanel()
    }
  })
})
</script>

<template>
  <div class="proxy-control">
    <button class="proxy-toggle" type="button" @click="togglePanel">
      {{ panelOpen ? 'Close proxy settings' : 'Open proxy settings' }} (Shift + P)
    </button>

    <transition name="fade">
      <section v-if="panelOpen" class="proxy-panel">
        <header>
          <h1>Tampermonkey Proxy Settings</h1>
          <p>
            All <code>fetch</code> and <code>XMLHttpRequest</code> calls will be rewritten to
            <code>{{ previewUrl }}</code>.
          </p>
        </header>

        <form class="form" @submit.prevent>
          <label>
            <span>Proxy protocol</span>
            <select v-model="proxySettings.protocol">
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </label>

          <label>
            <span>Proxy host</span>
            <input v-model="proxySettings.host" type="text" placeholder="proxy.example.com" />
          </label>

          <label>
            <span>Proxy port</span>
            <input v-model="proxySettings.port" type="text" inputmode="numeric" placeholder="8787" />
          </label>
        </form>

        <div class="actions">
          <button type="button" class="secondary" @click="resetToDefaults">Reset to defaults</button>
          <button type="button" @click="closePanel">Done</button>
        </div>
      </section>
    </transition>
  </div>
</template>

<style scoped>
.proxy-control {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  z-index: 2147483647;
}

.proxy-toggle {
  background: rgba(33, 150, 243, 0.92);
  color: #fff;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.9rem;
  border: none;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.35);
}

.proxy-toggle:hover {
  background: rgba(30, 136, 229, 0.95);
}

.proxy-panel {
  background: rgba(18, 18, 18, 0.95);
  color: #f5f5f5;
  border-radius: 0.75rem;
  padding: 1.25rem;
  width: min(22rem, 90vw);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.proxy-panel header {
  margin-bottom: 1rem;
}

.proxy-panel h1 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.proxy-panel p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
}

.proxy-panel code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.1rem 0.25rem;
  border-radius: 0.25rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
}

input,
select {
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 0.45rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
}

input:focus,
select:focus {
  outline: 2px solid rgba(33, 150, 243, 0.65);
  outline-offset: 2px;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

button.secondary {
  background: rgba(255, 255, 255, 0.15);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
