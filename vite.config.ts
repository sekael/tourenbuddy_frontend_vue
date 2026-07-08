import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VueRouter({
      routesFolder: 'src/app/router/pages',
      dts: 'src/typed-router.d.ts',
    }),
    vue(),
    // Bundled, tree-shaken SVG icons (Material Symbols via Iconify). Each
    // `~icons/material-symbols/<name>` import resolves to a Vue3 component at
    // build time — no runtime icon font, no CDN. See src/core/components/icons.ts.
    Icons({ compiler: 'vue3' }),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))],
      compositionOnly: true,
      strictMessage: true,
      escapeHtml: true,
    }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'TourenBuddy',
        short_name: 'TourenBuddy',
        description: 'Plan your outdoor tours with TourenBuddy',
        theme_color: '#e65100',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/apple-touch-icon-summer.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
