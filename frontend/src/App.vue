<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { normaliseBypassList } from './bypassPatterns'
import { DEFAULT_PROXY_SETTINGS, resetProxySettings } from './proxySettings'

const proxySettings = inject('proxySettings')
const panelOpen = ref(false)
const newBypassPattern = ref('')

const previewDetails = computed(() => {
  const protocol = proxySettings.protocol || DEFAULT_PROXY_SETTINGS.protocol
  const host = proxySettings.host || '<proxy-host>'
  const port = proxySettings.port ? `:${proxySettings.port}` : ':<proxy-port>'
  const sampleUrl = `${protocol}://${host}${port}/https://example.com/path`
  const bypassList = normaliseBypassList(proxySettings.bypassList)

  let bypassMessage =
    'All requests will be proxied unless they already point at the proxy host.'

  if (bypassList.length === 1) {
    bypassMessage = `Requests matching "${bypassList[0]}" will skip the proxy.`
  } else if (bypassList.length > 1) {
    bypassMessage = `Requests matching any of ${bypassList
      .map((pattern) => `"${pattern}"`)
      .join(', ')} will skip the proxy.`
  }

  return {
    sampleUrl,
    bypassList,
    bypassMessage,
  }
})

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function closePanel() {
  panelOpen.value = false
}

function resetToDefaults() {
  resetProxySettings()
  newBypassPattern.value = ''
}

function addBypassPattern() {
  const value = newBypassPattern.value.trim()
  if (!value) return

  const existing = normaliseBypassList(proxySettings.bypassList)
  const updated = normaliseBypassList([...existing, value])
  proxySettings.bypassList = updated

  newBypassPattern.value = ''
}

function removeBypassPattern(index) {
  const existing = normaliseBypassList(proxySettings.bypassList)
  proxySettings.bypassList = existing.filter((_, itemIndex) => itemIndex !== index)
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
            <code>{{ previewDetails.sampleUrl }}</code>.
          </p>
          <p class="bypass-preview">{{ previewDetails.bypassMessage }}</p>
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

          <div class="bypass-section">
            <span class="section-label">Bypass patterns</span>
            <p class="hint">
              Requests matching these hostnames or JavaScript-style regular expressions will not be proxied.
            </p>
            <div class="bypass-input">
              <input
                v-model="newBypassPattern"
                type="text"
                placeholder="e.g. api.example.com or /.internal/"
                @keyup.enter.prevent="addBypassPattern"
              />
              <button type="button" class="secondary" @click="addBypassPattern" :disabled="!newBypassPattern.trim()">
                Add
              </button>
            </div>
            <ul v-if="previewDetails.bypassList.length" class="bypass-list">
              <li v-for="(pattern, index) in previewDetails.bypassList" :key="pattern">
                <code>{{ pattern }}</code>
                <button type="button" class="icon" @click="removeBypassPattern(index)" aria-label="Remove pattern">
                  ✕
                </button>
              </li>
            </ul>
          </div>
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

.proxy-panel p + p {
  margin-top: 0.35rem;
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

form .hint {
  color: rgba(245, 245, 245, 0.75);
  font-size: 0.78rem;
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

.bypass-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-weight: 600;
  font-size: 0.85rem;
}

.bypass-input {
  display: flex;
  gap: 0.5rem;
}

.bypass-input input {
  flex: 1;
}

.bypass-input button {
  white-space: nowrap;
}

.bypass-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bypass-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.bypass-list button.icon {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  padding: 0.1rem 0.25rem;
}

.bypass-list button.icon:hover {
  color: #ff8a80;
}

.bypass-preview {
  color: rgba(245, 245, 245, 0.78);
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
