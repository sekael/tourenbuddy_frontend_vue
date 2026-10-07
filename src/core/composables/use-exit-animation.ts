import type { Ref } from 'vue'
import { onBeforeUnmount, onUnmounted } from 'vue'

/**
 * Exit animation for a surface whose OWNER unmounts it — e.g. a bottom sheet that
 * a parent swaps for a full-screen page with `v-if`/`<component :is>`. `<Transition>`
 * cannot cover that: its leave only runs when the Transition itself stays mounted,
 * and a teleported child is removed outright.
 *
 * On unmount, if Vue has already detached the element, it is put back where it was
 * (inert), plays `keyframes`, and is removed. If it is still connected,
 * an ancestor's leave transition is animating it (e.g. the map page's sheet slide),
 * so nothing is done.
 *
 * `keyframes` reads tokens off the element (`token('--motion-offset')`), so the
 * motion tokens — and their reduced-motion values — apply instead of literals.
 */
interface ExitSpec { frames: Keyframe[], duration: string, easing: string }

/** One quiet fade — the default exit for sheets and their scrims. */
export function fadeOut(token: (name: string) => string): ExitSpec {
  return {
    frames: [{ opacity: 1 }, { opacity: 0 }],
    duration: token('--motion-duration-short'),
    easing: token('--motion-ease-standard'),
  }
}

export function useExitAnimation(
  el: Ref<HTMLElement | null>,
  keyframes: (token: (name: string) => string) => ExitSpec,
) {
  // Captured before unmount: Vue nulls template refs while unmounting.
  let node: HTMLElement | null = null
  let parent: Node | null = null
  let next: Node | null = null
  let spec: ReturnType<typeof keyframes> | null = null

  onBeforeUnmount(() => {
    node = el.value
    if (!node)
      return
    parent = node.parentNode
    next = node.nextSibling
    const style = getComputedStyle(node)
    spec = keyframes(name => style.getPropertyValue(name).trim())
  })

  onUnmounted(() => {
    const ghost = node
    if (!ghost || !spec || ghost.isConnected || !parent?.isConnected || typeof ghost.animate !== 'function')
      return
    ghost.inert = true
    ghost.style.pointerEvents = 'none'
    // Re-inserting restarts CSS keyframes (entrances); global.css stops them here.
    ghost.setAttribute('data-exiting', '')
    parent.insertBefore(ghost, next?.parentNode === parent ? next : null)
    ghost.animate(spec.frames, { duration: Number.parseFloat(spec.duration) || 0, easing: spec.easing, fill: 'forwards' })
      .finished
      .catch(() => {})
      .finally(() => ghost.remove())
  })
}
