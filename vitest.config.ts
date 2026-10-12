import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vitest/config'

function virtualPwaRegisterStub(): Plugin {
  const moduleId = 'virtual:pwa-register/vue'
  const resolvedId = `\0${moduleId}`
  return {
    name: 'virtual-pwa-register-stub',
    resolveId(id) {
      if (id === moduleId)
        return resolvedId
    },
    load(id) {
      if (id === resolvedId) {
        return `import { ref } from 'vue'
export function useRegisterSW() {
  return { needRefresh: ref(false), offlineReady: ref(false), updateSW: () => {} }
}`
      }
    },
  }
}

const appVersion: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [vue(), Icons({ compiler: 'vue3' }), virtualPwaRegisterStub()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['test/**/*.test.ts', 'test/features/map/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
  },
})
