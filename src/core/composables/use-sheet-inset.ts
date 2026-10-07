import { onUnmounted, readonly, ref } from 'vue'

// Heights of every bottom sheet currently up. The tallest is published as
// `--sheet-inset` on <html> so bottom-anchored toasts sit above it instead of
// covering its actions (see global.css). With a sheet stacked over another,
// closing the top one falls back to the one below.
const insets = new Map<symbol, number>()
const tallest = ref(0)

/** The tallest open sheet's resting height (0 with none): the map area it covers. */
export const sheetInset = readonly(tallest)

function publish() {
  const root = document.documentElement.style
  tallest.value = insets.size === 0 ? 0 : Math.max(...insets.values())
  if (insets.size === 0)
    root.removeProperty('--sheet-inset')
  else
    root.setProperty('--sheet-inset', `${Math.max(...insets.values())}px`)
}

/** Returns a setter for this sheet's resting height; cleared on unmount. */
export function useSheetInset() {
  const key = Symbol('sheet')
  onUnmounted(() => {
    insets.delete(key)
    publish()
  })
  return (px: number) => {
    insets.set(key, px)
    publish()
  }
}
