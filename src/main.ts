import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router, { setupAuthRedirect, setupRouterGuards } from './app/router'
import { i18n, setupI18nLocaleWatcher } from './core/i18n'
import { installZodErrorMap } from './core/i18n/zod-error-map'
import { useAuthStore } from './features/auth/presentation/stores/auth-store'
import { useNotificationsStore } from './features/notifications/presentation/stores/notifications-store'
import { useUserProfileStore } from './features/user/presentation/stores/user-profile-store'
// Self-hosted Inter (weights used by --font-family-base). Bundled + precached,
// no Google Fonts CDN. To add a weight, import its @fontsource/inter/<n>.css
// here and confirm the woff2 is covered by the injectManifest glob.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './app/theme/global.css'

// A lazy route chunk failed to load. This is almost always a STALE build: the
// running app references chunk URLs that a newer deploy (or an updated service
// worker serving a stale index) has replaced, so every dynamic import 404s and
// navigation dead-ends with "Failed to fetch dynamically imported module".
// Reload to pull the fresh index + chunks. Throttled to at most once per 10s via
// sessionStorage so a chunk that's genuinely unfetchable (offline + uncached)
// can't spin the page in a reload loop.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'preloadErrorReloadAt'
  const last = Number(sessionStorage.getItem(KEY) ?? 0)
  if (Date.now() - last < 10_000)
    return
  sessionStorage.setItem(KEY, String(Date.now()))
  window.location.reload()
})

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(i18n)
  installZodErrorMap()
  setupI18nLocaleWatcher()
  app.use(pinia)

  // Initialize auth store and await session check before first navigation
  const authStore = useAuthStore()
  await authStore.initialize()

  const profileStore = useUserProfileStore()
  if (authStore.isAuthenticated) {
    await profileStore.loadProfile()
  }

  const notificationsStore = useNotificationsStore()
  if (authStore.isAuthenticated) {
    notificationsStore.ensurePushSubscription()
  }

  // Reload profile + redirect off the sign-in screen when a session lands mid-session;
  // clear stores and evict auth-only views on sign-out. Router guards only fire on
  // navigation, so this reactive half is what covers a session arriving without one.
  setupAuthRedirect(authStore, profileStore, notificationsStore)

  setupRouterGuards(authStore, profileStore)

  // AFTER the guards, deliberately: `app.use(router)` performs the first navigation as
  // part of installing, so registering the router earlier would resolve the entry URL with
  // an empty guard list — `/` would render the sign-in form for an already-authenticated
  // user, and `setupAuthRedirect` can't rescue it because its watcher was created once
  // `isAuthenticated` had already settled and so never fires.
  app.use(router)

  app.mount('#app')
}

bootstrap()
