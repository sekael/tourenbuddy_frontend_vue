import { useMediaQuery } from '@vueuse/core'

export function useIsTouch() {
  return useMediaQuery('(hover: none)')
}
