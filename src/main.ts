import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'
import App from './App.vue'
import router, { setupRouterGuards } from './app/router'
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
  app.use(router)

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

  // Reload profile when user logs in mid-session; clear on sign-out
  watch(
    () => authStore.isAuthenticated,
    async (isAuth) => {
      if (isAuth) {
        await profileStore.loadProfile()
        notificationsStore.ensurePushSubscription()
      }
      else {
        profileStore.clear()
        notificationsStore.clear()
        // Force redirect to home when session ends (e.g., sign-out in another tab).
        // Router guards only fire on navigation, so a reactive watcher is needed
        // to evict stale auth-only views.
        if (router.currentRoute.value.meta.requiresAuth)
          await router.push({ name: 'home' })
      }
    },
  )

  setupRouterGuards(authStore, profileStore)

  app.mount('#app')
}

bootstrap()
