import { watch } from 'vue'
import { supabase } from '@/core/utils/supabase'
import { replayQueue } from './replay'
import { isOnline } from './use-online-status'

let registered = false

/**
 * Flush TRIGGERS (change: offline-write-sync, DC7 / task 5.2). Kickstart a queue drain
 * on the cheap reachability signals so a pending offline write replays promptly, without
 * waiting for the next realtime `SUBSCRIBED` event (the authoritative trigger wired in
 * reconnect.ts). These are best-effort nudges: `replayQueue()` is single-flight, so an
 * overlapping drain is joined, never duplicated, and the DC9 backed-off retry in
 * replay.ts still covers a transient failure between nudges.
 *
 * Register once at app mount (side-effect-free import, like confirmConnectivity).
 */
export function registerFlushTriggers(): void {
  if (registered)
    return
  registered = true

  // Regained connectivity (offline → online) → drain now instead of on the next event.
  watch(isOnline, (online) => {
    if (online)
      void replayQueue()
  })

  // A session arrived (sign-in, or the token refresh that follows a reconnect) → drain
  // now. The drain guard in replay.ts bails while the session is unverified, so without
  // this trigger a flush kicked off by the coarse online flag would abort and the queue
  // would idle until the next reachability event. This is also what flushes work queued
  // offline when the persisted session was ultimately rejected and the user signed in
  // again — the outbox is durable and survives sign-out.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
      void replayQueue()
  })

  // App brought to the foreground while reachable → drain writes queued while hidden.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isOnline.value)
        void replayQueue()
    })
  }
}
