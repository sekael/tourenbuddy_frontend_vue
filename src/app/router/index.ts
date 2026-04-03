import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    redirectIfAuth?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/features/auth/presentation/pages/home-page.vue'),
      meta: { redirectIfAuth: true },
    },
    {
      path: '/auth/email',
      name: 'email-entry',
      component: () => import('@/features/auth/presentation/pages/email-entry-page.vue'),
      meta: { redirectIfAuth: true },
    },
    {
      path: '/auth/verify-otp',
      name: 'verify-otp',
      component: () => import('@/features/auth/presentation/pages/verify-otp-page.vue'),
      meta: { redirectIfAuth: true },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('@/features/map/presentation/pages/map-page.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

export function setupRouterGuards(authStore: { isAuthenticated: boolean, isLoading: boolean }) {
  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return { name: 'home' }
    }
    if (to.meta.redirectIfAuth && authStore.isAuthenticated) {
      return { name: 'map' }
    }
  })
}

export default router
