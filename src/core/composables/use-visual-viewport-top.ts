import { onBeforeUnmount, ref } from 'vue'

/**
 * How far the visible area is panned down from the layout viewport's top, in px — iOS pans
 * it while the on-screen keyboard is up, so fixed content at `top: 0` would scroll out of
 * view. Stays 0 on desktop, without `visualViewport`, and while the page is pinch-zoomed.
 * Deliberately no keyboard height: current iOS Safari shrinks `innerHeight` with the
 * keyboard and Brave iOS misreports `visualViewport.height`, so no formula holds everywhere.
 */
export function useVisualViewportTop() {
  const top = ref(0)
  const vv = window.visualViewport

  function update() {
    top.value = !vv || vv.scale > 1.01 ? 0 : Math.round(vv.offsetTop)
  }

  update()
  vv?.addEventListener('resize', update)
  vv?.addEventListener('scroll', update)
  onBeforeUnmount(() => {
    vv?.removeEventListener('resize', update)
    vv?.removeEventListener('scroll', update)
  })
  return top
}
