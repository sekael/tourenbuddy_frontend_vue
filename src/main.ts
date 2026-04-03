import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router, { setupRouterGuards } from './app/router'
import { useAuthStore } from './features/auth/presentation/stores/auth-store'
import './app/theme/global.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  // Initialize auth store and await session check before first navigation
  const authStore = useAuthStore()
  await authStore.initialize()
  setupRouterGuards(authStore)

  app.mount('#app')
}

bootstrap()
