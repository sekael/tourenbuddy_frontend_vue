import { ref } from 'vue'

/**
 * Is the current session UNVERIFIED — restored from storage without a successful token
 * refresh (change: auth-session-restore-redirect, design D2/D7)?
 *
 * A cold start with an expired access token refreshes over the network. When that
 * refresh fails retryably (offline, fetch error, slow auth endpoint) the auth store
 * adopts the persisted session's user so the app boots authenticated and serves its
 * offline caches — but the access token it holds is stale, so the SERVER would reject
 * every call until auth-js's next refresh succeeds.
 *
 * Module-level ref rather than auth-store state, mirroring `isOnline`
 * (`core/offline/use-online-status.ts`): `core/offline/mutate.ts` reads it to route
 * writes into the durable queue, and `core/` must not import a feature store.
 *
 * The auth store is the ONLY writer: set on adoption, cleared as soon as any
 * `onAuthStateChange` event delivers a real session (or signs the user out).
 */
export const sessionUnverified = ref(false)
