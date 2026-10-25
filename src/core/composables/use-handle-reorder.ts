import { ref } from 'vue'

/** Pointer this close to the scroll box's top or bottom edge scrolls the list. */
const EDGE_PX = 64
const MAX_SCROLL_STEP_PX = 16

/** The nearest ancestor that scrolls vertically and has something to scroll. */
function scrollParent(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight)
      return node
  }
  return null
}

/**
 * Reorder a list by a row's drag handle with Pointer Events, so a mouse, a pen and a finger all
 * work — native HTML drag-and-drop never fires for a finger on Android browsers. Rows carry
 * `data-reorder-index`; the handle (`touch-action: none`) captures the pointer, the dragged row
 * follows it (`offset`), and it would land after every other row whose middle is above the
 * pointer — past the end means last, back in its own slot means no move. Held near the
 * edge of its scroll box (a phone sheet showing two of seven stages), the list scrolls. Arrow
 * keys on a focused handle move one step.
 */
export function useHandleReorder(move: (from: number, to: number) => void) {
  const from = ref<number | null>(null)
  const over = ref<number | null>(null)
  /** Vertical px the dragged row has travelled, scrolling included. */
  const offset = ref(0)
  let startY = 0
  let pointerY = 0
  let scroller: HTMLElement | null = null
  /** The list's rows, read on pointerdown. */
  let rows: HTMLElement[] = []
  let startScroll = 0
  let frame = 0

  function reset() {
    cancelAnimationFrame(frame)
    scroller = null
    rows = []
    from.value = null
    over.value = null
    offset.value = 0
  }

  /** Where the dragged row would land: after every other row whose middle is above the pointer. */
  function target(): number {
    return rows.filter((row) => {
      const { top, height } = row.getBoundingClientRect()
      return Number(row.dataset.reorderIndex) !== from.value && top + height / 2 < pointerY
    }).length
  }

  function follow() {
    offset.value = pointerY - startY + (scroller ? scroller.scrollTop - startScroll : 0)
    if (rows.length > 0)
      over.value = target()
  }

  /** Each frame while dragging: scroll when held near an edge (faster the closer), then follow. */
  function tick() {
    if (scroller) {
      const { top, bottom } = scroller.getBoundingClientRect()
      const depth = Math.max(top + EDGE_PX - pointerY, 0) - Math.max(pointerY - (bottom - EDGE_PX), 0)
      if (depth !== 0) {
        scroller.scrollTop -= Math.sign(depth) * Math.min(Math.abs(depth) / 4 + 2, MAX_SCROLL_STEP_PX)
        follow()
      }
    }
    frame = requestAnimationFrame(tick)
  }

  /** Listeners for the handle of row `index` in a list of `count` rows (`v-bind` them). */
  function handleProps(index: number, count: number) {
    return {
      onPointerdown(e: PointerEvent) {
        if (e.button !== 0)
          return
        e.preventDefault()
        const handle = e.currentTarget as Element | null
        handle?.setPointerCapture?.(e.pointerId)
        pointerY = e.clientY
        startY = e.clientY
        const list = handle?.closest('[data-reorder-index]')?.parentElement
        rows = list ? [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && 'reorderIndex' in el.dataset) : []
        scroller = scrollParent(handle)
        startScroll = scroller?.scrollTop ?? 0
        from.value = index
        over.value = index
        frame = requestAnimationFrame(tick)
      },
      onPointermove(e: PointerEvent) {
        if (from.value === null)
          return
        pointerY = e.clientY
        follow()
      },
      onPointerup() {
        const [f, t] = [from.value, over.value]
        reset()
        if (f !== null && t !== null && f !== t)
          move(f, t)
      },
      onPointercancel: reset,
      onKeydown(e: KeyboardEvent) {
        const to = index + ({ ArrowUp: -1, ArrowDown: 1 }[e.key] ?? 0)
        if (to === index || to < 0 || to >= count)
          return
        e.preventDefault()
        move(index, to)
      },
    }
  }

  return { from, over, offset, handleProps }
}
