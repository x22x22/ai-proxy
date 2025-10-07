<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { DEFAULT_PROXY_SETTINGS, resetProxySettings } from './proxySettings'

const proxySettings = inject('proxySettings')
const panelOpen = ref(false)

const newBypassPattern = ref('')

function normaliseBypassPatterns(patterns) {
  if (!Array.isArray(patterns)) return []

  const seen = new Set()
  const result = []

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue
    const trimmed = pattern.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

const bypassSummary = computed(() => {
  const patterns = normaliseBypassPatterns(proxySettings.bypassPatterns)
  if (patterns.length === 0) {
    return '未设置绕过规则'
  }
  if (patterns.length <= 3) {
    return `绕过：${patterns.join('、')}`
  }
  const preview = patterns.slice(0, 3).join('、')
  return `绕过 ${patterns.length} 项：${preview} 等`
})

const previewUrl = computed(() => {
  const protocol = proxySettings.protocol || DEFAULT_PROXY_SETTINGS.protocol
  const host = proxySettings.host || '<proxy-host>'
  const port = proxySettings.port ? `:${proxySettings.port}` : ':<proxy-port>'
  const base = `${protocol}://${host}${port}/https://example.com/path`
  const summary = bypassSummary.value
  return summary ? `${base} • ${summary}` : base
})

function togglePanel() {
  if (panelOpen.value) {
    commitBypassPatterns()
  }
  panelOpen.value = !panelOpen.value
}

function closePanel() {
  commitBypassPatterns()
  panelOpen.value = false
}

function resetToDefaults() {
  resetProxySettings()
  newBypassPattern.value = ''
}

function updateBypassPattern(index, value) {
  const next = [...proxySettings.bypassPatterns]
  next[index] = value
  proxySettings.bypassPatterns = next
}

function commitBypassPatterns() {
  proxySettings.bypassPatterns = normaliseBypassPatterns(proxySettings.bypassPatterns)
}

function addBypassPattern() {
  const trimmed = newBypassPattern.value.trim()
  if (!trimmed) return
  const next = [...proxySettings.bypassPatterns, trimmed]
  proxySettings.bypassPatterns = normaliseBypassPatterns(next)
  newBypassPattern.value = ''
}

function removeBypassPattern(index) {
  const next = [...proxySettings.bypassPatterns]
  next.splice(index, 1)
  proxySettings.bypassPatterns = normaliseBypassPatterns(next)
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

          <div class="bypass-section">
            <span>绕过匹配规则</span>
            <p class="hint">输入要忽略代理的完整 URL 片段，或使用 <code>/pattern/</code> 形式的正则表达式。</p>

            <ul v-if="proxySettings.bypassPatterns.length" class="bypass-list">
              <li v-for="(pattern, index) in proxySettings.bypassPatterns" :key="`${pattern}-${index}`">
                <input
                  :value="pattern"
                  type="text"
                  placeholder="例如：/\\/v1\\/healthcheck/"
                  @input="updateBypassPattern(index, $event.target.value)"
                  @blur="commitBypassPatterns"
                />
                <button type="button" class="icon" @click="removeBypassPattern(index)" aria-label="删除绕过规则">
                  ×
                </button>
              </li>
            </ul>
            <p v-else class="empty">尚未配置任何绕过规则。</p>

            <div class="bypass-add">
              <input
                v-model="newBypassPattern"
                type="text"
                placeholder="添加新的绕过规则"
                @keyup.enter.prevent="addBypassPattern"
              />
              <button type="button" @click="addBypassPattern">添加</button>
            </div>
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

.bypass-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.bypass-section .hint {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(245, 245, 245, 0.75);
}

.bypass-section .empty {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(245, 245, 245, 0.6);
}

.bypass-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bypass-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.bypass-list li input {
  flex: 1;
}

.bypass-list button.icon {
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
  border: none;
  border-radius: 999px;
  width: 1.8rem;
  height: 1.8rem;
  font-size: 1rem;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.bypass-list button.icon:hover {
  background: rgba(255, 255, 255, 0.28);
}

.bypass-add {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.bypass-add input {
  flex: 1;
}

.bypass-add button {
  white-space: nowrap;
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
