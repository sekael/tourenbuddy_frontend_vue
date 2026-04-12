import { useMediaQuery } from '@vueuse/core'

/**
 * Returns a reactive boolean that is `true` when the viewport width is ≥600px (desktop).
 * Updates reactively on resize.
 */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 600px)')
}
