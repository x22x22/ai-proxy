/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

describe('userscript menu command', () => {
  it('opens the settings panel when the menu command is triggered', async () => {
    document.body.innerHTML = ''
    vi.resetModules()

    vi.stubGlobal('GM_getValue', vi.fn().mockReturnValue(null))
    vi.stubGlobal('GM_setValue', vi.fn())

    const registerMenuCommand = vi.fn()
    vi.stubGlobal('GM_registerMenuCommand', registerMenuCommand)

    try {
      await import('../src/main.js')

      if (registerMenuCommand.mock.calls.length === 0) {
        document.dispatchEvent(new Event('DOMContentLoaded'))
        await nextTick()
      }

      expect(registerMenuCommand).toHaveBeenCalledTimes(1)
      const [label, callback] = registerMenuCommand.mock.calls[0]
      expect(label).toBe('打开代理设置')
      expect(callback).toBeTypeOf('function')

      callback()
      await nextTick()

      const panel = document.querySelector('.proxy-panel')
      expect(panel).not.toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
