import { onUnmounted, ref } from 'vue'

/**
 * Reactive on-screen-keyboard inset, in CSS px, derived from the visual viewport.
 *
 * On iOS the layout viewport (`window.innerHeight`) does NOT shrink when the
 * keyboard opens — only the *visual* viewport does — and Android's default
 * `interactive-widget=resizes-visual` behaves the same. `K` is how many px the
 * keyboard eats from the bottom of the layout viewport:
 *
 *   K = max(0, innerHeight − (visualViewport.height + visualViewport.offsetTop))
 *
 * The `offsetTop` term matters on iOS, where the visual viewport can scroll
 * within* the layout viewport (firing `scroll`, not `resize`). The `max(0, …)`
 * clamp prevents a sub-pixel/transition negative from being read as a real
 * offset downstream.
 *
 * Pure: owns its listeners, writes no DOM. Consumers decide what to do with `inset`.
 */
export function useKeyboardInset() {
  const inset = ref(0)
  const vv = window.visualViewport

  function update() {
    if (!vv)
      return
    inset.value = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
  }

  if (vv) {
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
  }

  onUnmounted(() => {
    if (vv) {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  })

  return { inset }
}
