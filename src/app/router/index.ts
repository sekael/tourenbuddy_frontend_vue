import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    redirectIfAuth?: boolean
    requiresCompleteProfile?: boolean
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
      path: '/auth/check-email',
      name: 'check-email',
      component: () => import('@/features/auth/presentation/pages/check-email-page.vue'),
      meta: { redirectIfAuth: true },
    },
    {
      path: '/auth/callback',
      name: 'callback',
      component: () => import('@/features/auth/presentation/pages/callback-page.vue'),
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/features/user/presentation/pages/onboarding-page.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('@/features/map/presentation/pages/map-page.vue'),
      meta: { requiresAuth: true, requiresCompleteProfile: true },
    },
    {
      path: '/friends/requests',
      name: 'friend-requests',
      component: () => import('@/features/friendships/presentation/pages/friend-requests-page.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

export function setupRouterGuards(
  authStore: {
    isAuthenticated: boolean
    isLoading: boolean
  },
  profileStore: {
    profile: { firstName: string | null, lastName: string | null } | null
    sessionSkipped: boolean
  },
) {
  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return { name: 'home' }
    }

    if (to.meta.redirectIfAuth && authStore.isAuthenticated) {
      return { name: 'map' }
    }

    if (to.name === 'onboarding' && authStore.isAuthenticated && profileStore.profile) {
      const { firstName, lastName } = profileStore.profile
      if (firstName !== null && lastName !== null) {
        return { name: 'map' }
      }
    }

    if (to.meta.requiresCompleteProfile && authStore.isAuthenticated) {
      const profile = profileStore.profile
      const isComplete = profile !== null && profile.firstName !== null && profile.lastName !== null
      if (!isComplete && !profileStore.sessionSkipped) {
        return { name: 'onboarding' }
      }
    }
  })
}

export default router
