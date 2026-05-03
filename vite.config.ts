import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
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
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))],
      compositionOnly: true,
      strictMessage: true,
      escapeHtml: true,
    }),
    VitePWA({
      registerType: 'prompt',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/background-.*\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'welcome-backgrounds',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/vectortiles\.geo\.admin\.ch\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'swisstopo-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/wmts\.geo\.admin\.ch\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'swisstopo-wmts',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /\/storage\/v1\/object\/(?:sign\/)?tour-gpx\//i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tour-gpx-files',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
