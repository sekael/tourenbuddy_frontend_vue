import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'
import App from './App.vue'
import router, { setupRouterGuards } from './app/router'
import { i18n, setupI18nLocaleWatcher } from './core/i18n'
import { installZodErrorMap } from './core/i18n/zod-error-map'
import { useAuthStore } from './features/auth/presentation/stores/auth-store'
import { useNotificationsStore } from './features/notifications/presentation/stores/notifications-store'
import { useUserProfileStore } from './features/user/presentation/stores/user-profile-store'
import './app/theme/global.css'

// Icon-font fail-safe: reveal Material Symbols glyphs only once the font is
// actually loaded (see global.css `.fonts-ready` gate). Runs outside bootstrap
// so a slow auth init can't delay it. The timeout matches font-display: block's
// ~3s window — if the font CDN hangs, show whatever we have rather than hiding
// icons forever.
async function markFontsReadyOnLoad() {
  const reveal = () => document.documentElement.classList.add('fonts-ready')
  // Safety net first: never hide icons past font-display: block's ~3s window,
  // even if the font CDN stalls or document.fonts is unavailable.
  window.setTimeout(reveal, 3000)
  if (!document.fonts?.load)
    return reveal()
  try {
    // Force-request the icon font specifically, then await the FontFaceSet to
    // settle. Awaiting both guards the slow-stylesheet case where fonts.ready
    // would resolve before the icon @font-face is even enumerated.
    await Promise.all([
      document.fonts.load('20px "Material Symbols Outlined"'),
      document.fonts.ready,
    ])
  }
  finally {
    reveal()
  }
}
void markFontsReadyOnLoad()

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
