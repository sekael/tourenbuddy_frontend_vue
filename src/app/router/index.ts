import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { sessionUnverified } from '@/core/auth/session-trust'
import { isOnline } from '@/core/offline/use-online-status'

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
      path: '/auth/verify-otp',
      name: 'verify-otp',
      component: () => import('@/features/auth/presentation/pages/verify-otp-page.vue'),
      meta: { redirectIfAuth: true },
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
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/features/calendar/presentation/pages/calendar-page.vue'),
      meta: { requiresAuth: true, requiresCompleteProfile: true },
    },
    {
      path: '/friends/:friendshipId/backfill-collisions',
      name: 'backfill-collisions',
      component: () =>
        import('@/features/tour-links/presentation/pages/backfill-collisions-page.vue'),
      meta: { requiresAuth: true, requiresCompleteProfile: true },
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
      // Unreachable with nothing cached, the profile is UNKNOWN, not incomplete:
      // `cachedLoad` paints the cache and returns without fetching, so `null` here means
      // "couldn't load", and routing on it would send a fully-onboarded user to /onboarding
      // — where retyping their name queues an update that overwrites the server profile on
      // replay. An unverified session is unreachable for the same reason reads are skipped
      // there: the token can't be used yet.
      if ((!isOnline.value || sessionUnverified.value) && profile === null)
        return

      const isComplete = profile !== null && profile.firstName !== null && profile.lastName !== null
      if (!isComplete && !profileStore.sessionSkipped) {
        return { name: 'onboarding' }
      }
    }
  })
}

/**
 * The reactive half of the auth gate (change: auth-session-restore-redirect, design D1).
 *
 * `beforeEach` only runs on navigation, so a session that arrives WITHOUT one — a token
 * refresh landing after the app already rendered `/` — leaves an authenticated user
 * parked on the sign-in form. (Before #260 the "Get Started" button hid this by
 * triggering a navigation; afterwards, pressing "Send code" did the same, at the cost of
 * a rate-limited OTP on a session that was valid all along.)
 *
 * Both directions live here, together: auth-driven navigation split across two modules is
 * how one half gets updated and the other missed.
 */
export function setupAuthRedirect(
  authStore: { isAuthenticated: boolean },
  profileStore: { loadProfile: () => Promise<void>, clear: () => void },
  notificationsStore: { ensurePushSubscription: () => void, clear: () => void },
): void {
  watch(
    () => authStore.isAuthenticated,
    async (isAuth) => {
      if (isAuth) {
        // Order is load-bearing: the `requiresCompleteProfile` guard reads the profile, so
        // navigating first makes it see `null` and bounce a complete profile to onboarding.
        // Offline this awaits a cache read, not a network round trip.
        await profileStore.loadProfile()
        notificationsStore.ensurePushSubscription()
        // Only rescue a user STANDING on a signed-out-only screen. Auth also flips true
        // after an OTP verify and after a mid-session token rotation from deep in the app,
        // where an unconditional push would yank them off the page they're using.
        if (router.currentRoute.value.meta.redirectIfAuth)
          await router.push({ name: 'map' })
      }
      else {
        profileStore.clear()
        notificationsStore.clear()
        // Evict stale auth-only views when the session ends (e.g. sign-out in another tab).
        if (router.currentRoute.value.meta.requiresAuth)
          await router.push({ name: 'home' })
      }
    },
  )
}

export default router
