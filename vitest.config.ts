import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: [
      'test/**/*.test.ts',
      'test/features/map/**/*.spec.ts',
      'test/features/presence/**/*.test.ts',
    ],
    setupFiles: ['test/setup.ts'],
  },
})
