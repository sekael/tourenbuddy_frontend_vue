import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'
import App from './App.vue'
import router, { setupRouterGuards } from './app/router'
import { useAuthStore } from './features/auth/presentation/stores/auth-store'
import { useUserProfileStore } from './features/user/presentation/stores/user-profile-store'
import './app/theme/global.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  // Initialize auth store and await session check before first navigation
  const authStore = useAuthStore()
  await authStore.initialize()

  const profileStore = useUserProfileStore()
  if (authStore.isAuthenticated) {
    await profileStore.loadProfile()
  }

  // Reload profile when user logs in mid-session; clear on sign-out
  watch(
    () => authStore.isAuthenticated,
    async (isAuth) => {
      if (isAuth)
        await profileStore.loadProfile()
      else profileStore.clear()
    },
  )

  setupRouterGuards(authStore, profileStore)

  app.mount('#app')
}

bootstrap()
