<script setup lang="ts">
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { formatBytes } from '@/core/utils/format-bytes'
import { useOfflineMapStore } from '../stores/offline-map-store'

type Bbox = [number, number, number, number]
type Phase = 'idle' | 'drawing' | 'done'

interface LngLat { lng: number, lat: number }

const props = defineProps<{ map: MapLibreMap | null }>()
const emit = defineEmits<{ confirm: [bbox: Bbox], cancel: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useOfflineMapStore()
// Desktop = click two corners (map stays pannable); mobile = drag the map under
// a fixed frame. Captured on mount — a mid-draw viewport flip across 600px does
// not rewire handlers, negligible for a short-lived task overlay.
const isDesktop = useIsDesktop()

/** 'idle' = no corner yet · 'drawing' = first corner set, tracking cursor · 'done' = both set. */
const phase = ref<Phase>('idle')
// Desktop corners are anchored in GEO, not screen pixels, so the rectangle stays
// pinned to the ground while the user pans/zooms the map between clicks.
const startLL = ref<LngLat | null>(null)
const curLL = ref<LngLat | null>(null)
// Screen-pixel projection of the two corners, re-derived on every map move.
const startPx = ref<{ x: number, y: number } | null>(null)
const curPx = ref<{ x: number, y: number } | null>(null)
const bbox = ref<Bbox | null>(null)
/** Mobile frame in container-local px — single source of truth for the CSS square AND its bbox. */
const frameBox = ref<{ left: number, top: number, side: number } | null>(null)

/** Rectangle position in local (map-container) pixels, from the two corners (desktop). */
const rect = computed(() => {
  if (!startPx.value || !curPx.value)
    return null
  return {
    left: `${Math.min(startPx.value.x, curPx.value.x)}px`,
    top: `${Math.min(startPx.value.y, curPx.value.y)}px`,
    width: `${Math.abs(startPx.value.x - curPx.value.x)}px`,
    height: `${Math.abs(startPx.value.y - curPx.value.y)}px`,
  }
})

const frameStyle = computed(() =>
  frameBox.value
    ? {
        left: `${frameBox.value.left}px`,
        top: `${frameBox.value.top}px`,
        width: `${frameBox.value.side}px`,
        height: `${frameBox.value.side}px`,
      }
    : null,
)

const hasArea = computed(
  () => !!bbox.value && !!startPx.value && !!curPx.value
    && Math.abs(startPx.value.x - curPx.value.x) > 4
    && Math.abs(startPx.value.y - curPx.value.y) > 4,
)

/** Desktop needs a finished two-corner box; mobile's frame always has area. */
const canConfirm = computed(() =>
  isDesktop.value ? phase.value === 'done' && hasArea.value : !!bbox.value,
)

/** Step-appropriate title text; shows the live size estimate once a rectangle exists. */
const displayHint = computed(() => {
  if (!isDesktop.value)
    return t('offlineMap.draw.hintMobile', { size: formatBytes(store.estimate) })
  if (phase.value === 'idle')
    return t('offlineMap.draw.hintStart')
  if (phase.value === 'drawing')
    return hasArea.value ? formatBytes(store.estimate) : t('offlineMap.draw.hintExpand')
  return formatBytes(store.estimate)
})

/** Unproject two container-pixel corners → normalized WGS84 bbox (mobile frame). */
function bboxFrom(ax: number, ay: number, bx: number, by: number): Bbox | null {
  if (!props.map)
    return null
  const a = props.map.unproject([ax, ay])
  const b = props.map.unproject([bx, by])
  return [
    Math.min(a.lng, b.lng),
    Math.min(a.lat, b.lat),
    Math.max(a.lng, b.lng),
    Math.max(a.lat, b.lat),
  ]
}

// --- Desktop: geo-anchored two-click, map stays interactive --------------------

/** Re-project the geo corners to screen px so the drawn rectangle follows pan/zoom. */
function reproject() {
  if (!props.map || !startLL.value || !curLL.value)
    return
  const s = props.map.project(startLL.value)
  const c = props.map.project(curLL.value)
  startPx.value = { x: s.x, y: s.y }
  curPx.value = { x: c.x, y: c.y }
}

/** bbox straight from the two geo corners — independent of the current viewport. */
function syncBbox() {
  if (!startLL.value || !curLL.value)
    return
  const b: Bbox = [
    Math.min(startLL.value.lng, curLL.value.lng),
    Math.min(startLL.value.lat, curLL.value.lat),
    Math.max(startLL.value.lng, curLL.value.lng),
    Math.max(startLL.value.lat, curLL.value.lat),
  ]
  bbox.value = b
  store.updateEstimate(b)
}

function onMapClick(e: MapMouseEvent) {
  const ll = { lng: e.lngLat.lng, lat: e.lngLat.lat }
  switch (phase.value) {
    case 'idle': {
      startLL.value = ll
      curLL.value = ll
      bbox.value = null
      phase.value = 'drawing'
      reproject()
      break
    }
    case 'drawing': {
      curLL.value = ll
      phase.value = 'done'
      reproject()
      syncBbox()
      break
    }
    case 'done':
      break
  }
}

function onMapMouseMove(e: MapMouseEvent) {
  if (phase.value !== 'drawing')
    return
  curLL.value = { lng: e.lngLat.lng, lat: e.lngLat.lat }
  reproject()
  syncBbox()
}

// --- Mobile: fixed centered frame, map pans/zooms underneath -------------------

/** Recompute the centered frame's pixel rect for the current container size. */
function updateFrame() {
  const c = props.map?.getContainer()
  if (!c)
    return
  const { clientWidth: w, clientHeight: h } = c
  const side = Math.min(Math.min(w, h) * 0.7, 320)
  frameBox.value = { left: (w - side) / 2, top: (h - side) / 2, side }
  syncFrameBbox()
}

/** bbox from the frame's fixed screen rect — runs on every map move. */
function syncFrameBbox() {
  const f = frameBox.value
  const b = f && bboxFrom(f.left, f.top, f.left + f.side, f.top + f.side)
  if (!b)
    return
  bbox.value = b
  store.updateEstimate(b)
}

/** Start the two-click process over (desktop). */
function redraw() {
  phase.value = 'idle'
  startLL.value = null
  curLL.value = null
  startPx.value = null
  curPx.value = null
  bbox.value = null
  store.updateEstimate(null)
}

function confirm() {
  if (canConfirm.value && bbox.value)
    emit('confirm', bbox.value)
}

// Crosshair only while a corner can be placed (idle/drawing); revert to the
// normal navigation cursor once the rectangle is finished, until a redraw.
watch(phase, (p) => {
  if (isDesktop.value && props.map)
    props.map.getCanvas().style.cursor = p === 'done' ? '' : 'crosshair'
})

onMounted(() => {
  const m = props.map
  if (!m)
    return
  if (isDesktop.value) {
    // Map stays fully navigable; a drag pans (no 'click' fired), only a click
    // places a corner. 'move' re-pins the rectangle to the ground on pan/zoom.
    m.getCanvas().style.cursor = 'crosshair'
    m.on('click', onMapClick)
    m.on('mousemove', onMapMouseMove)
    m.on('move', reproject)
  }
  else {
    updateFrame()
    m.on('move', syncFrameBbox)
    m.on('resize', updateFrame)
  }
})
onBeforeUnmount(() => {
  const m = props.map
  if (m) {
    m.getCanvas().style.cursor = ''
    m.off('click', onMapClick)
    m.off('mousemove', onMapMouseMove)
    m.off('move', reproject)
    m.off('move', syncFrameBbox)
    m.off('resize', updateFrame)
  }
  store.updateEstimate(null)
})
</script>

<template>
  <div class="draw-layer">
    <!-- Desktop: geo-anchored rectangle, drawn from two map clicks (visual only). -->
    <div v-if="isDesktop && rect" class="rect" :style="rect" />
    <!-- Mobile: fixed frame, map pans/zooms underneath. -->
    <div v-else-if="!isDesktop && frameStyle" class="rect mobile-frame" :style="frameStyle" />

    <div class="hint">
      {{ displayHint }}
    </div>

    <div class="actions">
      <button type="button" class="cancel-btn" @click="emit('cancel')">
        {{ t('offlineMap.draw.cancel') }}
      </button>
      <button
        v-if="isDesktop && phase === 'done'"
        type="button"
        class="cancel-btn"
        @click="redraw"
      >
        {{ t('offlineMap.draw.redraw') }}
      </button>
      <BaseButton
        v-if="!isDesktop || phase === 'done'"
        variant="primary"
        :disabled="!canConfirm"
        @click="confirm"
      >
        {{ t('offlineMap.draw.confirm') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.draw-layer {
  position: absolute;
  inset: 0;
  z-index: 200;
  /* Click-through so map gestures (pan/zoom) reach the canvas underneath;
     pointer-events inherits, so children are none unless they opt back to auto.
     Corner clicks are captured via the map's own 'click' event, not the DOM. */
  pointer-events: none;
}

.rect {
  position: absolute;
  border: 2px solid var(--color-accent, #2563eb);
  background-color: color-mix(in srgb, var(--color-accent, #2563eb) 18%, transparent);
  pointer-events: none;
}

.mobile-frame {
  border-radius: var(--radius-sm);
}

.hint {
  position: fixed;
  top: calc(var(--spacing-lg) + var(--safe-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  background-color: rgba(248, 250, 252, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: var(--shadow-sm);
}

.actions {
  position: fixed;
  bottom: calc(var(--spacing-lg) + var(--safe-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-md);
  pointer-events: auto;
}

.cancel-btn {
  padding: var(--button-padding-md);
  border-radius: var(--button-radius);
  font-size: var(--button-font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  background-color: rgba(248, 250, 252, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(203, 213, 225, 0.6);
  box-shadow: var(--shadow-sm);
}
</style>
