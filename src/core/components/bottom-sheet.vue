<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title?: string
  ariaLabel?: string
  /** Collapse to just the header (drag handle + title). Content slot is not rendered. */
  collapsed?: boolean
  /** When set, shows a back arrow button in the header. */
  showBack?: boolean
}>()

const emit = defineEmits<{ close: [], back: [] }>()

const { t } = useI18n({ useScope: 'global' })

const titleId = 'bottom-sheet-title'

// ── Snap points ──────────────────────────────────────────────────────────────
type Snap = 'peek' | 'default' | 'expanded'
const SNAP_ORDER: Snap[] = ['peek', 'default', 'expanded']

const peekHeight = ref(64)
const defaultHeight = computed(() => Math.round(window.innerHeight * 0.4))
const expandedHeight = computed(() => Math.round(window.innerHeight * 0.6))

function snapHeightPx(snap: Snap): number {
  if (snap === 'peek')
    return peekHeight.value
  if (snap === 'default')
    return defaultHeight.value
  return expandedHeight.value
}

// ── Internal state ───────────────────────────────────────────────────────────
const currentHeight = ref(0)
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

function applySnap(snap: Snap, immediate = false) {
  lastSnap.value = snap
  if (immediate) {
    currentHeight.value = snapHeightPx(snap)
  }
  else {
    // Trigger transition by setting height — CSS transition handles animation
    currentHeight.value = snapHeightPx(snap)
  }
}

// ── Drag logic ───────────────────────────────────────────────────────────────
let startY = 0
let startHeight = 0
let lastMoveY = 0
let activeDragPointerId: number | null = null

function onDragStart(e: PointerEvent) {
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
  currentHeight.value = clamped
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
    currentHeight.value = snapHeightPx(lastSnap.value)
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
  currentHeight.value = expandedHeight.value
  await nextTick()

  const el = sheetRef.value
  if (!el) {
    lastSnap.value = 'expanded'
    await nextTick()
    isDragging.value = false
    return
  }

  // CSS max-height: 60vh acts as the ceiling — offsetHeight at height:auto
  // gives us min(naturalContentH, 60vh) directly.
  el.style.height = 'auto'
  const measuredH = el.offsetHeight
  const targetH = measuredH > 0 ? measuredH : expandedHeight.value
  // Set inline immediately to avoid a flash before Vue's reactive render
  el.style.height = `${targetH}px`

  currentHeight.value = targetH
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
  // Re-apply current snap with updated viewport heights
  currentHeight.value = snapHeightPx(lastSnap.value)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
const headerResizeObserver = ref<ResizeObserver | null>(null)

onMounted(() => {
  updatePeekHeight()

  headerResizeObserver.value = new ResizeObserver(() => {
    updatePeekHeight()
    if (!isDragging.value) {
      currentHeight.value = snapHeightPx(lastSnap.value)
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
      <button
        v-if="props.showBack && !props.collapsed"
        type="button"
        class="back-btn"
        :aria-label="t('core.drawer.back')"
        @click="emit('back')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      </button>
      <h2 v-if="props.title" :id="titleId" class="title">
        {{ props.title }}
      </h2>
      <div v-else class="title-spacer" />
      <slot name="header-actions" />
      <button
        v-if="!props.collapsed"
        type="button"
        class="close-btn"
        :aria-label="t('core.drawer.close')"
        @click="emit('close')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
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
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border: 1px solid var(--color-outline-variant);
  border-bottom: none;
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm) var(--spacing-xl) 0;
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
  border-radius: 9999px;
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
  padding-bottom: var(--spacing-md);
}

.back-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.back-btn:hover {
  background-color: var(--color-surface-variant);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex: 1;
}

.title-spacer {
  flex: 1;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: var(--spacing-xs);
  /* Home indicator clearance: last list item stays reachable above gesture bar */
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
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
  padding: var(--spacing-sm) 0 calc(var(--spacing-xl) + env(safe-area-inset-bottom, 0px));
}
</style>
