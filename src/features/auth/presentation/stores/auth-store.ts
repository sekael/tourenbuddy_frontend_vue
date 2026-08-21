import type { User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sessionUnverified } from '@/core/auth/session-trust'
import { toEmailLocale } from '@/core/i18n/to-email-locale'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'

export const useAuthStore = defineStore('auth', () => {
  const logger = useLogger('AuthStore')

  const currentUser = ref<User | null>(null)
  const isLoading = ref(true)

  const isAuthenticated = computed(() => currentUser.value !== null)

  /**
   * Read the persisted session WITHOUT going through auth-js, so a failed refresh
   * doesn't cost us the user (design D3).
   *
   * The storage key is found by pattern, never written: `SupabaseClient.storageKey` is
   * `protected`, and PINNING our own value in `createClient` would sign every existing
   * user out if it differed from auth-js's default by one character. A read-only lookup
   * fails closed — a stale pattern means "no adoption", i.e. the old behaviour.
   * One client per origin, so exactly one key can match.
   */
  function readPersistedUser(): User | null {
    try {
      const key = Object.keys(localStorage).find(
        k => k.startsWith('sb-') && k.endsWith('-auth-token'),
      )
      if (!key)
        return null
      const stored = localStorage.getItem(key)
      if (!stored)
        return null
      const session = JSON.parse(stored) as { user?: User, refresh_token?: string }
      // Both are required: a user id to key the offline caches, a refresh token to prove
      // this is a session auth-js can still revive rather than a leftover fragment.
      return session.user?.id && session.refresh_token ? session.user : null
    }
    catch {
      return null
    }
  }

  /** Initialize auth state from existing session and subscribe to changes. */
  async function initialize() {
    const { data, error } = await supabase.auth.getSession()
    currentUser.value = data.session?.user ?? null

    // No session, but the refresh may simply have been unreachable: `getSession()` hits
    // the network when the stored access token is inside the expiry margin, and a
    // RETRYABLE failure (offline / fetch error) leaves the persisted session intact for
    // auth-js to revive later. Booting signed out there strands an authenticated user on
    // the sign-in form — the offline-capable app locked behind a form needing network,
    // and a pointless OTP (rate-limited) as the only way out. Adopt the stored user
    // instead; a PERMANENT error (revoked / invalid refresh token) still signs out.
    if (!currentUser.value && (error?.name === 'AuthRetryableFetchError' || !navigator.onLine)) {
      const persisted = readPersistedUser()
      if (persisted) {
        currentUser.value = persisted
        sessionUnverified.value = true
        logger.info('Adopted persisted session — refresh unreachable', { userId: persisted.id })
      }
      else {
        // Tripwire for the storage-key pattern going stale (design D3): we WANTED to
        // adopt and found nothing to adopt.
        logger.warn('Session refresh unreachable and no persisted session found')
      }
    }

    isLoading.value = false

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser.value = session?.user ?? null
      // Any event settles the question: a delivered session is verified, and no session
      // means signed out — either way the adopted-session caveat no longer applies.
      sessionUnverified.value = false
      logger.debug('Auth state changed', { event: _event, userId: session?.user?.id })
    })
  }

  async function sendEmailOtp(email: string) {
    const localeStore = useLocaleStore()
    const emailLocale = toEmailLocale(localeStore.locale)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { locale: emailLocale },
      },
    })
    if (error)
      throw error
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error)
      throw error
  }

  /** Refetch the user record without touching the refresh token. */
  async function refreshCurrentUser() {
    const { data } = await supabase.auth.getUser()
    currentUser.value = data.user ?? currentUser.value
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error)
      throw error
    currentUser.value = null
    sessionUnverified.value = false
  }

  return {
    currentUser,
    isLoading,
    isAuthenticated,
    initialize,
    sendEmailOtp,
    verifyOtp,
    refreshCurrentUser,
    signOut,
  }
})
