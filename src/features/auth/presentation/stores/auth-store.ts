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
  function findSessionKey(): string | undefined {
    return Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token'),
    )
  }

  function readPersistedUser(): User | null {
    try {
      const key = findSessionKey()
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

  /**
   * How long to wait for the session check before falling back to the persisted session.
   *
   * auth-js retries an unreachable token refresh with exponential backoff for a full
   * AUTO_REFRESH_TICK_DURATION_MS (30s) before giving up, and the app can't mount until
   * the session settles — so an offline cold start with an expired access token would sit
   * on a blank screen for half a minute. We can answer that question locally in
   * milliseconds, so cap the wait and let the retries finish in the background.
   */
  const SESSION_RESTORE_TIMEOUT_MS = 2000

  /** Initialize auth state from existing session and subscribe to changes. */
  async function initialize() {
    // Whatever the refresh eventually decides still reaches us through onAuthStateChange:
    // success emits TOKEN_REFRESHED, a permanent failure removes the session and emits
    // SIGNED_OUT. Racing it only shortens the wait; it doesn't discard the outcome.
    const pending = supabase.auth.getSession()
    void pending.catch(() => {})
    const timedOut = Symbol('timeout')
    const raced = await Promise.race([
      pending,
      new Promise<typeof timedOut>(resolve =>
        setTimeout(() => resolve(timedOut), SESSION_RESTORE_TIMEOUT_MS),
      ),
    ])

    const { data, error } = raced === timedOut
      // Indistinguishable from an unreachable refresh at this point, and treated as one.
      ? { data: { session: null }, error: { name: 'AuthRetryableFetchError' } }
      : raced

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

    supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Auth state changed', { event, userId: session?.user?.id })

      // A delivered session settles the question: verified, adopted-session caveat gone.
      if (session) {
        currentUser.value = session.user
        sessionUnverified.value = false
        return
      }

      // Only `_removeSession()` emits SIGNED_OUT, and only for an explicit sign-out or a
      // PERMANENT refresh failure — so it's the one null we can trust.
      if (event === 'SIGNED_OUT') {
        currentUser.value = null
        sessionUnverified.value = false
      }

      // Every other null is transient. `onAuthStateChange` replays INITIAL_SESSION to each
      // new subscriber by re-running the session load, so offline it re-attempts the same
      // refresh that already failed above and hands us `null` — taking that at face value
      // would undo the adoption a few lines up and bounce an authenticated offline user to
      // the sign-in form. Hold what we have; a real sign-out still arrives as SIGNED_OUT.
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

  /**
   * Signing out must succeed offline — otherwise the one escape from an unverified
   * session needs the network the user doesn't have.
   *
   * auth-js can't deliver that: `signOut()` loads the session first (offline that repeats
   * the refresh that already failed and returns an error), and otherwise POSTs `/logout`
   * and bails on anything that isn't a 401/403/404. Either way it returns early WITHOUT
   * `_removeSession()`, leaving the session on disk — which the next cold start would
   * adopt, signing the user straight back in.
   *
   * So: best-effort revoke, then drop the local session ourselves regardless. Never
   * throws — a sign-out that reports failure while having destroyed local state is worse
   * than one that quietly leaves a server session to expire on its own.
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error)
      logger.warn('Sign-out did not reach the server; clearing the local session anyway', error)

    const key = findSessionKey()
    if (key)
      localStorage.removeItem(key)

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
