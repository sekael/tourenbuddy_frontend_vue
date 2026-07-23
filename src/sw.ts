/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import { OFFLINE_MAP_CACHE } from './features/map/data/services/offline-map-cache'
import { pickTileResponse } from './features/map/data/services/pick-tile-response'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Honor user-driven update prompt (vite-plugin-pwa registerType: 'prompt')
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING')
    self.skipWaiting()
})

// Take control of already-open clients the moment this SW activates, so the
// offline tile route intercepts fetches on the very FIRST visit — without it a
// fresh install serves the page uncontrolled until a reload, which is why
// offline tiles only appeared "after a reload". This is clients.claim (control),
// NOT skipWaiting — the user still approves updates (registerType: 'prompt').
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

// Welcome screen background images
registerRoute(
  ({ url }) => /\/assets\/background-.*\.webp$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'welcome-backgrounds',
    plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Swisstopo vector tiles — runtime (opportunistic) cache
const vectorTilesSwr = new StaleWhileRevalidate({
  cacheName: 'swisstopo-tiles',
  plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 })],
})

// Offline-first base map: serve an explicitly-downloaded tile/asset from the
// offline cache when present, else fall through to the runtime SWR handler.
// Registered BEFORE the runtime route (Workbox evaluates in registration order)
// and matches all shards (vectortiles0-4) + the bare host (style/sprite/glyphs).
registerRoute(
  ({ url }) => /^vectortiles\d?\.geo\.admin\.ch$/.test(url.host),
  options =>
    pickTileResponse(options.request, {
      // ignoreVary: stored tiles keep Swisstopo's `Vary` header, so a
      // header-less match(url) would miss and fall through to the network.
      cacheMatch: async url =>
        (await caches.open(OFFLINE_MAP_CACHE)).match(url, { ignoreVary: true }),
      swrHandler: () => vectorTilesSwr.handle(options) as Promise<Response>,
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

// Tour attachments — signed URLs are short-lived; MUST NOT be cached
registerRoute(
  ({ url }) => /\/storage\/v1\/object\/(?:sign\/)?tour-attachments\//i.test(url.pathname),
  new NetworkOnly(),
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
