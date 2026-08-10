import { ref } from 'vue'

/**
 * One reactive online/offline signal shared across the app (change:
 * offline-app-cache-sync, design D3). Module-level singleton — the same pattern the
 * realtime layer uses for `pageVisible` — so every store and the UI observe the
 * exact same ref. Stores consult it to skip the network offline; the UI consults it
 * to surface offline state.
 *
 * Seeded from `navigator.onLine` and updated by the `window` `online`/`offline`
 * events, registered once at module init. `navigator.onLine` is coarse ("has a
 * network interface", not "can reach Supabase") — acceptable: a false positive just
 * runs the online path whose fetch falls back to cache on failure (cachedLoad).
 */
export const isOnline = ref<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
)

/**
 * While offline, re-probe on an interval so we UPGRADE back to online even when the
 * browser never fires an `online` event. DevTools request-blocking (and a cold offline
 * boot corrected by the probe below) can leave us offline without a matching transition
 * event, so relying on `online` alone leaves the pill / write-block stuck on forever.
 * The timer only runs while offline — it stops the moment we're back online.
 */
let recheckTimer: ReturnType<typeof setInterval> | null = null
const RECHECK_INTERVAL_MS = 5000

async function probe(): Promise<boolean> {
  if (typeof fetch !== 'function')
    return true
  try {
    // Same-origin, non-cached request to a path no SW route intercepts (not a
    // navigation, not precached) — reaches the network and rejects when offline.
    await fetch(`/__online_check__?ts=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    return true
  }
  catch {
    return false
  }
}

function goOnline() {
  isOnline.value = true
  if (recheckTimer) {
    clearInterval(recheckTimer)
    recheckTimer = null
  }
}

function goOffline() {
  isOnline.value = false
  if (recheckTimer || typeof setInterval !== 'function')
    return
  recheckTimer = setInterval(async () => {
    if (await probe())
      goOnline()
  }, RECHECK_INTERVAL_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
}

/**
 * Correct a stuck "online" on a COLD offline boot. When the service worker serves
 * the shell offline, the initial `navigator.onLine` read can be `true` (the renderer
 * hasn't learned the network state yet) and — because no online→offline *transition*
 * happened — no `offline` event ever fires to fix it. The signal stays `true`, so the
 * pill hides and writes hit the network and fail silently.
 *
 * Probe once at startup when we THINK we're online; a failed probe downgrades us AND
 * arms the re-probe loop (`goOffline`), so we recover when connectivity returns even
 * without an `online` event. Call from app mount (not module init) so importing this
 * module stays side-effect-free for tests.
 */
export async function confirmConnectivity(): Promise<void> {
  if (!isOnline.value || typeof fetch !== 'function')
    return
  if (!(await probe()))
    goOffline()
}
