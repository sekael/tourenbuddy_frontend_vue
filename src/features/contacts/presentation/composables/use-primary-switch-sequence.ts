import type { Ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { onScopeDispose, ref, watch } from 'vue'

/** Highlight fade (out, then in) and row move durations; the CSS reads them via custom properties. */
export const PRIMARY_FADE_MS = 320
export const PRIMARY_MOVE_MS = 700

/**
 * Stages a primary-phone switch as three visible steps (issue #320): the old
 * primary's highlight fades out, the rows reorder, the new primary's highlight
 * fades in. `orderId` drives the list order, `highlightId` the highlight; both
 * follow `target`. A newer target mid-sequence restarts from wherever the list
 * is. Without a previous primary, with no new one, or under reduced motion,
 * both follow immediately.
 */
export function usePrimarySwitchSequence(target: Ref<string | null>) {
  const orderId = ref(target.value)
  const highlightId = ref(target.value)
  const reducedMotion = usePreferredReducedMotion()
  let run = 0
  onScopeDispose(() => run++)

  // Resolves true unless a newer switch (or unmount) took over meanwhile.
  const pause = (ms: number, current: number) =>
    new Promise<boolean>(resolve => setTimeout(() => resolve(current === run), ms))

  watch(target, async (next) => {
    const current = ++run
    if (reducedMotion.value === 'reduce' || orderId.value === null || next === null) {
      orderId.value = next
      highlightId.value = next
      return
    }
    highlightId.value = null
    if (!await pause(PRIMARY_FADE_MS, current))
      return
    if (orderId.value !== next) {
      orderId.value = next
      if (!await pause(PRIMARY_MOVE_MS, current))
        return
    }
    highlightId.value = next
  })

  return { orderId, highlightId }
}
