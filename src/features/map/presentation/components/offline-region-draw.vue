<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import { formatBytes } from '@/core/utils/format-bytes'
import { useOfflineMapStore } from '../stores/offline-map-store'

type Bbox = [number, number, number, number]

const props = defineProps<{ map: MapLibreMap | null }>()
const emit = defineEmits<{ confirm: [bbox: Bbox], cancel: [] }>()

const { t } = useI18n({ useScope: 'global' })
const store = useOfflineMapStore()

const startPx = ref<{ x: number, y: number } | null>(null)
const curPx = ref<{ x: number, y: number } | null>(null)
const bbox = ref<Bbox | null>(null)

/** Rectangle position in local (map-container) pixels, from the two drag corners. */
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

const hasArea = computed(
  () => !!bbox.value && !!startPx.value && !!curPx.value
    && Math.abs(startPx.value.x - curPx.value.x) > 4
    && Math.abs(startPx.value.y - curPx.value.y) > 4,
)

function localPx(e: PointerEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  startPx.value = localPx(e, el)
  curPx.value = startPx.value
  bbox.value = null
}

function onMove(e: PointerEvent) {
  if (!startPx.value)
    return
  curPx.value = localPx(e, e.currentTarget as HTMLElement)
  syncBbox()
}

/** Unproject the two corner pixels → WGS84 bbox, and refresh the live estimate. */
function syncBbox() {
  if (!props.map || !startPx.value || !curPx.value)
    return
  const a = props.map.unproject([startPx.value.x, startPx.value.y])
  const b = props.map.unproject([curPx.value.x, curPx.value.y])
  bbox.value = [
    Math.min(a.lng, b.lng),
    Math.min(a.lat, b.lat),
    Math.max(a.lng, b.lng),
    Math.max(a.lat, b.lat),
  ]
  store.updateEstimate(bbox.value)
}

function confirm() {
  if (hasArea.value && bbox.value)
    emit('confirm', bbox.value)
}

// Suspend map panning while drawing so the drag draws instead of moving the map.
onMounted(() => props.map?.dragPan.disable())
onBeforeUnmount(() => {
  props.map?.dragPan.enable()
  store.updateEstimate(null)
})
</script>

<template>
  <div class="draw-layer">
    <div
      class="draw-surface"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="syncBbox"
    >
      <div v-if="rect" class="rect" :style="rect" />
    </div>

    <div class="hint">
      {{ hasArea ? formatBytes(store.estimate) : t('offlineMap.draw.hint') }}
    </div>

    <div class="actions">
      <button type="button" class="cancel-btn" @click="emit('cancel')">
        {{ t('offlineMap.draw.cancel') }}
      </button>
      <BaseButton variant="primary" :disabled="!hasArea" @click="confirm">
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
}

.draw-surface {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}

.rect {
  position: absolute;
  border: 2px solid var(--color-accent, #2563eb);
  background-color: color-mix(in srgb, var(--color-accent, #2563eb) 18%, transparent);
  pointer-events: none;
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
