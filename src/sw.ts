/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Honor user-driven update prompt (vite-plugin-pwa registerType: 'prompt')
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING')
    self.skipWaiting()
})

// Welcome screen background images
registerRoute(
  ({ url }) => /\/assets\/background-.*\.webp$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'welcome-backgrounds',
    plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Swisstopo vector tiles
registerRoute(
  ({ url }) => url.origin === 'https://vectortiles.geo.admin.ch',
  new StaleWhileRevalidate({
    cacheName: 'swisstopo-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Swisstopo WMTS raster tiles
registerRoute(
  ({ url }) => url.origin === 'https://wmts.geo.admin.ch',
  new StaleWhileRevalidate({
    cacheName: 'swisstopo-wmts',
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// GPX files in Supabase storage
registerRoute(
  ({ url }) => /\/storage\/v1\/object\/(?:sign\/)?tour-gpx\//i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'tour-gpx-files',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Push notification handler
// SEPARATION INVARIANT: this handler ONLY calls showNotification.
// It MUST NOT postMessage, fetch app routes, or mutate store state.
// Realtime (postgres_changes) handles in-app UI sync; push handles OS notifications only.
self.addEventListener('push', (event) => {
  interface PushData {
    title?: string
    body?: string
    url?: string
  }

  let data: PushData = {}
  try {
    data = (event.data?.json() as PushData) ?? {}
  }
  catch {
    // malformed payload — use generic fallback
  }

  const title = data.title ?? 'TourenBuddy'
  const body = data.body ?? 'You have a new notification.'
  const url = data.url ?? '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  )
})

// Notification click handler
// SEPARATION INVARIANT: this handler ONLY does focus/navigate/openWindow.
// It MUST NOT postMessage store mutations or trigger any Realtime/fetch side effects.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => new URL(c.url).origin === self.location.origin)
      if (existing) {
        existing.focus()
        existing.navigate(targetUrl)
        return
      }
      self.clients.openWindow(targetUrl)
    }),
  )
})
