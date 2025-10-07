import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monkey from 'vite-plugin-monkey'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'AI Proxy Redirector',
        namespace: 'https://github.com/ai-proxy',
        version: '0.1.0',
        description:
          'Intercepts fetch/XMLHttpRequest calls and rewrites them to a configurable reverse proxy endpoint.',
        match: ['*://*/*'],
        grant: ['GM_getValue', 'GM_setValue'],
      },
      build: {
        fileName: 'ai-proxy-redirector.user.js',
      },
    }),
  ],
})
