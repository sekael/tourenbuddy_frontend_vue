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
