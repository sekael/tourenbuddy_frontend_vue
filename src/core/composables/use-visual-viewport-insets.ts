import { onBeforeUnmount, ref } from 'vue'

/** Below this, the gap is browser-chrome or rounding jitter — no on-screen keyboard is that short. */
const MIN_KEYBOARD_PX = 50

/**
 * How much of the layout viewport the user cannot see right now, in px. iOS and Android
 * Chrome shrink only the visual viewport for the on-screen keyboard, so a bottom-fixed
 * control would sit behind it: `bottom` is how far the keyboard reaches up from the layout
 * viewport's bottom edge, `top` how far iOS has panned the visible area down from its top.
 * Both stay 0 on desktop, without `visualViewport`, and while the page is pinch-zoomed.
 */
export function useVisualViewportInsets() {
  const top = ref(0)
  const bottom = ref(0)
  const vv = window.visualViewport

  function update() {
    if (!vv || vv.scale > 1.01) {
      top.value = 0
      bottom.value = 0
      return
    }
    const hidden = window.innerHeight - vv.height - vv.offsetTop
    top.value = Math.round(vv.offsetTop)
    bottom.value = hidden < MIN_KEYBOARD_PX ? 0 : Math.round(hidden)
  }

  update()
  vv?.addEventListener('resize', update)
  vv?.addEventListener('scroll', update)
  onBeforeUnmount(() => {
    vv?.removeEventListener('resize', update)
    vv?.removeEventListener('scroll', update)
  })
  return { top, bottom }
}
