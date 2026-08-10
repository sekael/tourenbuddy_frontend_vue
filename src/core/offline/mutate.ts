import { ref } from 'vue'
import { isOnline } from '@/core/offline/use-online-status'

/**
 * The single seam every in-scope mutation store action passes through (change:
 * offline-app-cache-sync, design D5). Online it just runs `fn`; offline it blocks
 * the write, signals the UI to show a localized "unavailable offline" notice, and
 * returns without touching state — nothing is partially applied or queued.
 *
 * This is intentionally the ONE place the offline-write decision lives: ~20 call
 * sites route through here rather than each carrying its own `if (!isOnline)`
 * guard, so offline-write-sync converts drop→enqueue by changing this one function
 * (design D6). Keep it tiny and side-effect-free beyond the notice signal.
 *
 * `offlineBlockedAt` is bumped (not a boolean) so each blocked attempt is a fresh
 * event the UI can react to even when already offline; a plain module module ref
 * keeps i18n out of this non-component module (the indicator component translates).
 */
export const offlineBlockedAt = ref(0)

export async function mutate<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (!isOnline.value) {
    offlineBlockedAt.value = Date.now()
    return undefined
  }
  return fn()
}
