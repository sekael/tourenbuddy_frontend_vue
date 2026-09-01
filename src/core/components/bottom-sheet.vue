<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIconButton from './base-icon-button.vue'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to just the header (drag handle + title). Content slot is not rendered. */
  collapsed?: boolean
  /** When set, shows a back arrow button in the header. */
  showBack?: boolean
  /**
   * Size to min(content height, max-height) and keep refitting on resize,
   * instead of snapping to peek/default/expanded. For confirm-style sheets
   * whose whole content must be visible without dragging the sheet up.
   */
  fitContent?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })

const titleId = 'bottom-sheet-title'

// ── Snap points ──────────────────────────────────────────────────────────────
type Snap = 'peek' | 'default' | 'expanded'
const SNAP_ORDER: Snap[] = ['peek', 'default', 'expanded']

const peekHeight = ref(64)
const defaultHeight = computed(() => Math.round(window.innerHeight * 0.4))
const expandedHeight = computed(() => Math.round(window.innerHeight * 0.7))

function snapHeightPx(snap: Snap): number {
  if (snap === 'peek')
    return peekHeight.value
  if (snap === 'default')
    return defaultHeight.value
  return expandedHeight.value
}

// ── Internal state ───────────────────────────────────────────────────────────
// The bottom sheet is view-mode only (data entry goes to a full-screen page),
// so there's no keyboard-vs-sheet sizing: the applied height is just the resting
// height the snap/fit/drag logic writes.
const restingHeight = ref(0)
const currentHeight = computed(() => restingHeight.value)
const isDragging = ref(false)
const lastSnap = ref<Snap>('default')

const sheetRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

function updatePeekHeight() {
  const headerEl = headerRef.value
  const handleEl = handleRef.value
  const h = (headerEl?.offsetHeight ?? 56) + (handleEl?.offsetHeight ?? 8)
  peekHeight.value = h
}

function applySnap(snap: Snap) {
  lastSnap.value = snap
  // Set the resting base; `currentHeight` maps it to the applied height.
  // CSS transition on `height` animates the change.
  restingHeight.value = snapHeightPx(snap)
}

// ── Drag logic ───────────────────────────────────────────────────────────────
let startY = 0
let startHeight = 0
let lastMoveY = 0
let activeDragPointerId: number | null = null

function onDragStart(e: PointerEvent) {
  // Inert while collapsed.
  if (props.collapsed)
    return
  e.preventDefault()
  isDragging.value = true
  startY = e.clientY
  startHeight = currentHeight.value
  lastMoveY = e.clientY
  activeDragPointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onDragMove(e: PointerEvent) {
  if (!isDragging.value)
    return
  e.preventDefault()
  const delta = e.clientY - startY
  const clamped = Math.round(
    Math.max(peekHeight.value, Math.min(expandedHeight.value, startHeight - delta)),
  )
  // Drag is gated while the keyboard is open, so writing the resting base here
  // updates the applied height live (transition is suppressed during the drag).
  restingHeight.value = clamped
  lastMoveY = e.clientY
}

function onDragEnd(e: PointerEvent) {
  if (!isDragging.value)
    return
  isDragging.value = false
  activeDragPointerId = null

  const totalDelta = Math.abs(e.clientY - startY)
  if (totalDelta < 4) {
    // tap — restore snap without change
    restingHeight.value = snapHeightPx(lastSnap.value)
    return
  }

  const dragDirection = lastMoveY < startY ? 'up' : 'down'
  const snap = nearestSnap(currentHeight.value, dragDirection)
  applySnap(snap)
}

function cancelDrag() {
  if (!isDragging.value)
    return
  isDragging.value = false
  if (activeDragPointerId !== null && handleRef.value) {
    try {
      handleRef.value.releasePointerCapture(activeDragPointerId)
    }
    catch {
      // pointer may already be released
    }
    activeDragPointerId = null
  }
  applySnap(lastSnap.value)
}

function nearestSnap(heightPx: number, bias: 'up' | 'down'): Snap {
  const snaps: Snap[] = ['peek', 'default', 'expanded']
  let best: Snap = snaps[0]
  let bestDist = Infinity

  for (const snap of snaps) {
    const h = snapHeightPx(snap)
    const dist = Math.abs(h - heightPx)
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

// ── Keyboard a11y ────────────────────────────────────────────────────────────
const snapIndex = computed(() => SNAP_ORDER.indexOf(lastSnap.value))

function onHandleKeydown(e: KeyboardEvent) {
  const idx = SNAP_ORDER.indexOf(lastSnap.value)
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    applySnap(SNAP_ORDER[Math.min(idx + 1, SNAP_ORDER.length - 1)])
  }
  else if (e.key === 'ArrowDown') {
    e.preventDefault()
    applySnap(SNAP_ORDER[Math.max(idx - 1, 0)])
  }
  else if (e.key === 'Home') {
    e.preventDefault()
    applySnap('expanded')
  }
  else if (e.key === 'End') {
    e.preventDefault()
    applySnap('peek')
  }
}

// ── Natural height open ──────────────────────────────────────────────────────
async function openAtNaturalHeight() {
  isDragging.value = true
  restingHeight.value = expandedHeight.value
  await nextTick()

  const el = sheetRef.value
  if (!el) {
    lastSnap.value = 'expanded'
    await nextTick()
    isDragging.value = false
    return
  }

  // Measure natural content height, then clamp to the expanded ceiling
  // (innerHeight * 0.7) so the sheet never exceeds 70% of the *visible*
  // viewport. We can't lean on CSS `max-height: 70vh` for this: `vh` is the
  // large viewport (full height behind the mobile URL bar), so on-device it's
  // taller than `innerHeight * 0.7` and the sheet would overshoot. When the
  // content is taller than the cap, `targetH` lands exactly on the expanded
  // snap, so it reads as snapped to 70%.
  el.style.height = 'auto'
  const measuredH = el.offsetHeight
  const targetH = measuredH > 0 ? Math.min(measuredH, expandedHeight.value) : expandedHeight.value
  // Set inline immediately to avoid a flash before Vue's reactive render
  el.style.height = `${targetH}px`

  restingHeight.value = targetH
  lastSnap.value = nearestSnap(targetH, 'up')
  await nextTick()
  isDragging.value = false
}

// ── Collapse prop ────────────────────────────────────────────────────────────
watch(
  () => props.collapsed,
  (collapsed) => {
    if (collapsed) {
      cancelDrag()
    }
    else {
      void openAtNaturalHeight()
    }
  },
)

// ── Viewport resize ──────────────────────────────────────────────────────────
function onWindowResize() {
  updatePeekHeight()
  // Re-apply current snap with updated viewport heights — or refit to content.
  if (props.fitContent)
    void openAtNaturalHeight()
  else
    restingHeight.value = snapHeightPx(lastSnap.value)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
const headerResizeObserver = ref<ResizeObserver | null>(null)

onMounted(() => {
  updatePeekHeight()

  headerResizeObserver.value = new ResizeObserver(() => {
    updatePeekHeight()
    if (!isDragging.value) {
      if (props.fitContent)
        void openAtNaturalHeight()
      else
        restingHeight.value = snapHeightPx(lastSnap.value)
    }
  })

  if (headerRef.value)
    headerResizeObserver.value.observe(headerRef.value)
  if (handleRef.value)
    headerResizeObserver.value.observe(handleRef.value)

  if (!props.collapsed)
    void openAtNaturalHeight()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  headerResizeObserver.value?.disconnect()
  window.removeEventListener('resize', onWindowResize)
})

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
      'bottom-sheet--dragging': isDragging,
    }"
    :style="sheetStyle"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="props.title ? titleId : undefined"
    :aria-label="!props.title ? (props.ariaLabel ?? t('core.drawer.back')) : undefined"
  >
    <div
      v-if="!props.collapsed"
      ref="handleRef"
      class="drag-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-valuemin="0"
      aria-valuemax="2"
      :aria-valuenow="snapIndex"
      :aria-label="t('core.bottomSheet.resizeHandle')"
      tabindex="0"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @keydown="onHandleKeydown"
    />

    <div ref="headerRef" class="header">
      <BaseIconButton
        v-if="props.showBack && !props.collapsed"
        name="arrow_back"
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
        size="sm"
        :label="t('core.drawer.close')"
        @click="emit('close')"
      />
    </div>

    <div v-show="!props.collapsed" class="content">
      <slot />
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
  /* Secondary safety net only — JS clamps the applied height to
     innerHeight * 0.7. `dvh` (visible viewport) keeps this in step with that
     clamp; `vh` would be the larger viewport and let the sheet overshoot 70%. */
  max-height: 70dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border: 1px solid var(--color-outline-variant);
  border-bottom: none;
  box-shadow: var(--shadow-lg);
  /* Compact horizontal padding (md, not xl) so more width goes to content. */
  padding: var(--spacing-sm) var(--spacing-md) 0;
  transition: height 200ms ease-out;
  /* Restore pointer events — parent sheet-container sets pointer-events: none
     to allow FAB clicks through transparent areas */
  pointer-events: auto;
}

.bottom-sheet--dragging {
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
  padding-bottom: var(--spacing-sm);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex: 1;
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
  overflow-y: auto;
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

.footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-outline-variant);
  /* Base padding trimmed (md, not xl); env() still clears the home-gesture bar. */
  padding: var(--spacing-sm) 0 calc(var(--spacing-md) + var(--safe-bottom));
}
</style>
