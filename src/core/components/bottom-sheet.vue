<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fadeOut, useExitAnimation } from '@/core/composables/use-exit-animation'
import { useSheetInset } from '@/core/composables/use-sheet-inset'
import BaseIconButton from './base-icon-button.vue'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to just the header (drag handle + title). Content slot is not rendered. */
  collapsed?: boolean
  /** When set, shows a back arrow button in the header. */
  showBack?: boolean
  /**
   * Sized by the content, gliding whenever it changes — the mobile twin of
   * `DialogWindow`. Opens at the content height (capped at 70% of the viewport).
   * Only if the content needs more than that does the sheet get a drag handle,
   * to expand up to the full content (capped at 90%) or drop to peek; content
   * that fits shows no handle, as there is nothing to reveal.
   */
  fitContent?: boolean
  /**
   * With `fitContent`: always draggable, even when the content fits. Snaps to
   * peek, the opening height (content, capped at 40%) and the full content
   * (capped at 70%). For browse surfaces the user resizes to see more or less of
   * the map — the tour list and tour detail.
   */
  resizable?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })

const titleId = 'bottom-sheet-title'

// ── Snap points ──────────────────────────────────────────────────────────────
type Snap = 'peek' | 'default' | 'expanded'
const SNAP_ORDER: Snap[] = ['peek', 'default', 'expanded']

// Reactive visible-viewport height: snaps follow rotation and URL-bar changes.
const { height: viewportHeight } = useWindowSize()
const peekHeight = ref(64)
const defaultHeight = computed(() => Math.round(viewportHeight.value * 0.4))
const expandedHeight = computed(() => Math.round(viewportHeight.value * 0.7))
/** Fit-content ceiling: room above stays for the status bar and a glimpse of the page. */
const fullHeight = computed(() => Math.round(viewportHeight.value * 0.9))
/** Natural height (chrome + content), uncapped; 0 until measured. */
const naturalHeight = ref(0)
/** The handle's share of `naturalHeight` (0 while it is not rendered). */
const handleShare = ref(0)

// A fit-content sheet is only resizable when its content does not fit at the
// opening height. Decided without the handle's own height, so showing or hiding
// the handle can never flip the decision back.
const draggable = computed(() => !props.fitContent
  || props.resizable
  || naturalHeight.value === 0
  || naturalHeight.value - handleShare.value > expandedHeight.value)

const snaps = computed<Snap[]>(() => draggable.value ? SNAP_ORDER : ['default'])

function snapHeightPx(snap: Snap): number {
  if (snap === 'peek')
    return peekHeight.value
  if (!props.fitContent)
    return snap === 'expanded' ? expandedHeight.value : defaultHeight.value
  // Unmeasurable (e.g. not laid out yet): fall back to the opening cap.
  const natural = naturalHeight.value || expandedHeight.value
  const [opening, full] = props.resizable
    ? [defaultHeight.value, expandedHeight.value]
    : [expandedHeight.value, fullHeight.value]
  return Math.min(natural, snap === 'expanded' ? full : opening)
}

// ── Internal state ───────────────────────────────────────────────────────────
// The bottom sheet is view-mode only (data entry goes to a full-screen page),
// so there's no keyboard-vs-sheet sizing: the applied height is just the resting
// height the snap/fit/drag logic writes.
const currentHeight = ref(0)
const isDragging = ref(false)
// Height changes glide, except the very first size (the sheet is still sliding in).
const glide = ref(false)
const lastSnap = ref<Snap>(props.fitContent ? 'default' : 'expanded')

const sheetRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

function updatePeekHeight() {
  const headerEl = headerRef.value
  const handleEl = handleRef.value
  const h = (headerEl?.offsetHeight ?? 56) + (handleEl?.offsetHeight ?? 8)
  peekHeight.value = h
}

function applySnap(snap: Snap) {
  lastSnap.value = snap
  currentHeight.value = snapHeightPx(snap)
}

// ── Natural height ───────────────────────────────────────────────────────────
// Measured arithmetically, without resetting the inline height (so it can glide):
// everything that is not the scroll box (handle, header, footer, padding) plus what
// the content needs. `.content-body` keeps its natural height inside the scroll
// box, so its size is the content's real height however tall the sheet is.
// Snap caps use the *visible* viewport (`useWindowSize`); CSS `vh` is the large
// viewport and would let the sheet overshoot on device.
function measureNaturalHeight() {
  const sheet = sheetRef.value
  const content = contentRef.value
  if (!sheet || !content)
    return 0
  const px = (v: string) => Number.parseFloat(v) || 0
  const sheetStyle = getComputedStyle(sheet)
  const contentStyle = getComputedStyle(content)
  // Summed per element rather than `sheet − content`: at the first fit the sheet is
  // still 0px tall and its header overflows, so it would not count.
  let natural = px(sheetStyle.paddingTop) + px(sheetStyle.paddingBottom)
    + px(contentStyle.marginTop) + px(contentStyle.paddingTop) + px(contentStyle.paddingBottom)
    + (bodyRef.value?.offsetHeight ?? 0)
  for (const child of sheet.children) {
    if (child !== content)
      natural += (child as HTMLElement).offsetHeight
  }
  handleShare.value = handleRef.value?.offsetHeight ?? 0
  return Math.max(0, Math.ceil(natural))
}

/** Re-fit to the content. Leaves a sheet the user dragged to peek alone. */
function refit() {
  if (props.collapsed || isDragging.value)
    return
  naturalHeight.value = measureNaturalHeight()
  if (props.fitContent) {
    // Content shrank so the handle goes away: back to the one resting height.
    applySnap(snaps.value.includes(lastSnap.value) ? lastSnap.value : 'default')
    return
  }
  if (lastSnap.value === 'peek')
    return
  // Non-fit sheets open at their natural height (capped), then snap normally.
  const opening = Math.min(naturalHeight.value || expandedHeight.value, expandedHeight.value)
  currentHeight.value = opening
  lastSnap.value = nearestSnap(opening, 'up')
}

// The handle comes and goes with `draggable`; peek includes it.
watch(draggable, async () => {
  await nextTick()
  updatePeekHeight()
})

// ── Drag logic ───────────────────────────────────────────────────────────────
/** px/ms — a release faster than this moves one snap in the flick direction. */
const FLICK_VELOCITY = 0.5
let startY = 0
let startHeight = 0
let prevMove = { y: 0, t: 0 }
let lastMove = { y: 0, t: 0 }
let activeDragPointerId: number | null = null

let captureEl: HTMLElement | null = null

/** Rubber-band past the top snap: the sheet follows the finger with growing resistance. */
const OVERSTRETCH = 48
function resist(px: number) {
  return OVERSTRETCH * (1 - 1 / (1 + px / OVERSTRETCH))
}

function onDragStart(e: PointerEvent) {
  // Inert while collapsed or when there is nothing to resize. The header drags
  // too (a bigger target than the bar), except from its buttons.
  if (props.collapsed || !draggable.value || (e.target as Element).closest('button, a, input'))
    return
  e.preventDefault()
  isDragging.value = true
  startY = e.clientY
  startHeight = currentHeight.value
  prevMove = lastMove = { y: e.clientY, t: e.timeStamp }
  activeDragPointerId = e.pointerId
  captureEl = e.currentTarget as HTMLElement
  captureEl.setPointerCapture(e.pointerId)
}

function onDragMove(e: PointerEvent) {
  if (!isDragging.value)
    return
  e.preventDefault()
  const ceiling = snapHeightPx('expanded')
  const wanted = startHeight - (e.clientY - startY)
  currentHeight.value = Math.round(wanted > ceiling
    ? ceiling + resist(wanted - ceiling)
    : Math.max(peekHeight.value, wanted))
  prevMove = lastMove
  lastMove = { y: e.clientY, t: e.timeStamp }
}

function onDragEnd(e: PointerEvent) {
  if (!isDragging.value)
    return
  isDragging.value = false
  activeDragPointerId = null

  if (Math.abs(e.clientY - startY) < 4) {
    // tap — restore snap without change
    applySnap(lastSnap.value)
    return
  }

  // Velocity of the last movement; stale if the finger rested before lifting.
  const dt = lastMove.t - prevMove.t
  const velocity = dt > 0 && e.timeStamp - lastMove.t < 100 ? (lastMove.y - prevMove.y) / dt : 0
  const direction = lastMove.y < startY ? 'up' : 'down'
  applySnap(Math.abs(velocity) > FLICK_VELOCITY
    ? nextSnap(currentHeight.value, velocity < 0 ? 'up' : 'down')
    : nearestSnap(currentHeight.value, direction))
}

function cancelDrag() {
  if (!isDragging.value)
    return
  isDragging.value = false
  if (activeDragPointerId !== null && captureEl) {
    try {
      captureEl.releasePointerCapture(activeDragPointerId)
    }
    catch {
      // pointer may already be released
    }
    activeDragPointerId = null
  }
  applySnap(lastSnap.value)
}

function nearestSnap(heightPx: number, bias: 'up' | 'down'): Snap {
  let best: Snap = snaps.value[0]!
  let bestDist = Infinity

  for (const snap of snaps.value) {
    const dist = Math.abs(snapHeightPx(snap) - heightPx)
    if (dist < bestDist) {
      bestDist = dist
      best = snap
    }
    else if (dist === bestDist) {
      // tie-break by drag direction
      const idx = SNAP_ORDER.indexOf(snap)
      const bestIdx = SNAP_ORDER.indexOf(best)
      if (bias === 'up' && idx > bestIdx)
        best = snap
      if (bias === 'down' && idx < bestIdx)
        best = snap
    }
  }
  return best
}

/** The first snap beyond `heightPx` in the flick direction (or the last one). */
function nextSnap(heightPx: number, direction: 'up' | 'down'): Snap {
  const ordered = direction === 'up' ? snaps.value : [...snaps.value].reverse()
  return ordered.find(snap => direction === 'up'
    ? snapHeightPx(snap) > heightPx
    : snapHeightPx(snap) < heightPx) ?? ordered.at(-1)!
}

// ── Keyboard a11y ────────────────────────────────────────────────────────────
const snapIndex = computed(() => snaps.value.indexOf(lastSnap.value))

function onHandleKeydown(e: KeyboardEvent) {
  const list = snaps.value
  const idx = list.indexOf(lastSnap.value)
  const target = ({
    ArrowUp: list[Math.min(idx + 1, list.length - 1)],
    ArrowDown: list[Math.max(idx - 1, 0)],
    Home: 'expanded',
    End: 'peek',
  } as Record<string, Snap | undefined>)[e.key]
  if (!target)
    return
  e.preventDefault()
  applySnap(target)
}

// ── Collapse prop ────────────────────────────────────────────────────────────
watch(
  () => props.collapsed,
  async (collapsed) => {
    if (collapsed) {
      cancelDrag()
    }
    else {
      lastSnap.value = props.fitContent ? 'default' : 'expanded'
      await nextTick()
      refit()
    }
  },
)

// ── Viewport resize ──────────────────────────────────────────────────────────
watch(viewportHeight, () => {
  updatePeekHeight()
  if (props.fitContent || lastSnap.value === 'peek')
    refit()
  else
    applySnap(lastSnap.value)
})

// The map area the sheet covers, for toasts (`--sheet-inset`) and camera framing.
// The resting height, not the gliding one: a camera move starts before the glide ends.
const publishInset = useSheetInset()
watch(currentHeight, (px) => {
  if (!props.collapsed)
    publishInset(px)
})

// ── Lifecycle ────────────────────────────────────────────────────────────────
let observer: ResizeObserver | undefined

onMounted(() => {
  updatePeekHeight()

  // Header/handle → peek height; body → content changed (views, tabs, data
  // loading); sheet → its on-screen height for `--sheet-inset`.
  observer = new ResizeObserver((entries) => {
    if (entries.some(entry => entry.target !== sheetRef.value)) {
      updatePeekHeight()
      if (props.fitContent)
        refit()
    }
    if (sheetRef.value && props.collapsed)
      publishInset(sheetRef.value.offsetHeight)
  })
  for (const el of [headerRef.value, handleRef.value, bodyRef.value, sheetRef.value]) {
    if (el)
      observer.observe(el)
  }

  if (!props.collapsed)
    refit()
  requestAnimationFrame(() => requestAnimationFrame(() => (glide.value = true)))
})

onUnmounted(() => {
  observer?.disconnect()
})

// Swapped out by its owner (e.g. for a full-screen page): fade instead of vanishing.
useExitAnimation(sheetRef, fadeOut)

const sheetStyle = computed(() => {
  if (props.collapsed)
    return {}
  return { height: `${currentHeight.value}px` }
})
</script>

<template>
  <div
    ref="sheetRef"
    class="bottom-sheet"
    :class="{
      'bottom-sheet--collapsed': props.collapsed,
      'bottom-sheet--still': isDragging || !glide,
      'bottom-sheet--static': !draggable,
    }"
    :style="sheetStyle"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="props.title ? titleId : undefined"
    :aria-label="!props.title ? (props.ariaLabel ?? t('core.drawer.back')) : undefined"
  >
    <div
      v-if="!props.collapsed && draggable"
      ref="handleRef"
      class="drag-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-valuemin="0"
      :aria-valuemax="snaps.length - 1"
      :aria-valuenow="snapIndex"
      :aria-label="t('core.bottomSheet.resizeHandle')"
      tabindex="0"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @keydown="onHandleKeydown"
    />

    <div
      ref="headerRef"
      class="header"
      :class="{ 'header--drag': !props.collapsed && draggable }"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
    >
      <BaseIconButton
        v-if="props.showBack && !props.collapsed"
        name="arrow_back"
        variant="tonal"
        size="sm"
        :label="t('core.drawer.back')"
        @click="emit('back')"
      />
      <h2 v-if="props.title" :id="titleId" class="title">
        {{ props.title }}
      </h2>
      <div v-else class="title-spacer" />
      <slot name="header-actions" />
      <BaseIconButton
        v-if="!props.collapsed"
        name="close"
        variant="tonal"
        size="sm"
        :label="t('core.drawer.close')"
        @click="emit('close')"
      />
    </div>

    <div v-show="!props.collapsed" ref="contentRef" class="content">
      <!-- Natural height (never stretched): measuring it gives the fitted height. -->
      <div ref="bodyRef" class="content-body">
        <slot />
      </div>
    </div>

    <div v-if="$slots.footer" v-show="!props.collapsed" class="footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet {
  width: 100%;
  max-width: var(--bottom-sheet-max-width, 480px);
  /* Secondary safety net only — JS clamps the applied height to at most
     innerHeight * 0.9 (fully expanded fit-content sheet). `dvh` (visible
     viewport) keeps this in step; `vh` would be the larger viewport. */
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border-bottom: none;
  box-shadow: var(--shadow-lg);
  /* Compact horizontal padding (md, not xl) so more width goes to content. */
  padding: var(--spacing-sm) var(--spacing-md) 0;
  transition: height var(--motion-duration-medium) var(--motion-ease-emphasized);
  /* Restore pointer events — parent sheet-host sets pointer-events: none
     to allow FAB clicks through transparent areas */
  pointer-events: auto;
}

.bottom-sheet--static {
  /* No handle above the header: keep the same breathing room it would give. */
  padding-top: var(--spacing-md);
}

.bottom-sheet--still {
  transition: none;
}

.bottom-sheet--collapsed {
  max-height: none;
  height: auto !important;
  padding-top: var(--spacing-md);
}

.bottom-sheet--collapsed .header {
  padding-bottom: var(--spacing-md);
}

.drag-handle {
  position: relative;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  flex-shrink: 0;
  cursor: ns-resize;
  touch-action: none;
  outline: none;
  /* Visual bar via pseudo-element to keep tap target large */
}

.drag-handle::after {
  content: '';
  display: block;
  width: 36px;
  height: 4px;
  background-color: var(--color-outline-variant);
  border-radius: var(--radius-pill);
}

.drag-handle:focus-visible::after {
  background-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--spacing-sm);

  /* Opaque and stacked above `.content`, which is a later sibling and would
     otherwise paint over this one. The 1px overlap that closes the scroll seam
     lives on `.content`, not here — see the note there for why. */
  padding-bottom: var(--spacing-sm);
  position: relative;
  z-index: 1;
  background-color: var(--color-background);
}

/* Drags like the handle: no browser pan may steal the gesture. */
.header--drag {
  touch-action: none;
}

.title {
  font-size: var(--overlay-title-size);
  font-weight: var(--font-weight-semibold);
  flex: 1;
  letter-spacing: var(--overlay-title-tracking);
}

.title-spacer {
  flex: 1;
}

.content {
  /* Published so slotted content can bleed a full-width divider to the sheet edges — the
     sheet itself pads `md` on both sides, this element adds `xs` on the right. */
  --surface-pad-left: var(--spacing-md);
  --surface-pad-right: calc(var(--spacing-md) + var(--spacing-xs));

  flex: 1;
  min-height: 0;
  /* Tucks this scroll box 1px under the opaque `.header`, then gives that pixel
     straight back as padding. A composited scroll region whose top edge lands on
     a fractional pixel — this one does: sheet padding + 24px handle + a
     content-sized header with an `xl` title — paints one row of pixels outside
     its own clip box, which shows as a hairline of scrolling text above the
     header's bottom edge. Stacking does not govern that escape, so the header
     has to physically reach over it.

     The pair belongs HERE rather than as a negative margin on `.header`: putting
     it there pulled this box up without compensating, so the first pixel row of
     every sheet's slotted content sat under the header and was clipped — visible
     as content cut off at the top of the profile and contact sheets. With the
     padding on this side, the covered pixel is padding, not content. Do not
     "tidy" either half away; they only work as a pair. */
  margin-top: -1px;
  padding-top: 1px;
  /* Traps slotted `z-index` inside this scroll region. Load-bearing because
     `.header` overlaps this element by 1px: a sticky header in slotted
     content needs its own `z-index` to cover the rows scrolling under it, and
     without a stacking context here it competes directly with `.header` — on an
     equal `z-index` the later DOM node wins and reclaims that overlap.
     `isolation`, not a `z-index` bump: the sheet must not care what values
     slotted content picks. */
  isolation: isolate;
  overflow-y: auto;
  /* Explicit, not incidental: leaving overflow-x unset here computes it to
     `auto` too (CSS Overflow spec — an unset axis inherits `auto` from a sibling
     axis that isn't `visible`), silently opening a horizontal scrollbar/gesture
     the moment any flex row's content is a pixel too wide. Sheets scroll
     vertically only. */
  overflow-x: hidden;
  /* Scroll stops here: past either end it must not chain to the page, the
     document, or the map behind the sheet. `contain`, not `none` — the region
     keeps its own end-of-scroll rubber-band. */
  overscroll-behavior: contain;
  padding-right: var(--spacing-xs);
  /* Home indicator clearance: last list item stays reachable above gesture bar */
  padding-bottom: calc(var(--spacing-md) + var(--safe-bottom));
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--color-outline-variant) transparent;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-thumb {
  background-color: var(--color-outline-variant);
  border-radius: 3px;
}

/* With a footer below, content fades out over its last 24px instead of being cut
   off at the footer's edge, and gets that much more bottom room so the final row
   can still scroll clear of the fade. */
.content:has(~ .footer) {
  mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent);
  padding-bottom: var(--spacing-xl);
}

.footer {
  flex-shrink: 0;
  /* Base padding trimmed (md, not xl); env() still clears the home-gesture bar. */
  padding: var(--spacing-sm) 0 calc(var(--spacing-md) + var(--safe-bottom));
}
</style>
