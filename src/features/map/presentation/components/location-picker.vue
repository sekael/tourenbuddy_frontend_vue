<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useI18n } from 'vue-i18n'
import Crosshair from '@/core/components/crosshair.vue'

const props = defineProps<{
  map: MapLibreMap | null
  /** Pixels to offset the Cancel/Continue buttons from the bottom of the viewport. */
  actionsBottom?: number
}>()

const emit = defineEmits<{
  confirm: [location: { lng: number, lat: number }]
  cancel: []
}>()

const { t } = useI18n({ useScope: 'global' })

/**
 * Returns the geographic coordinates at the visual center of the map canvas —
 * i.e., exactly where the crosshair SVG renders.
 *
 * We MUST NOT use `map.getCenter()` here: MapLibre's `getCenter()` returns the
 * center of the *padded* viewport, and padding persists after `flyTo({ padding })`
 * calls (e.g., when the tour info sheet is open). That would cause the saved
 * location to be offset from where the user aimed the crosshair.
 *
 * `map.unproject()` converts a pixel position to geographic coordinates and is
 * unaffected by padding state.
 */
function getCrosshairCoordinates(map: NonNullable<typeof props.map>) {
  const canvas = map.getCanvas()
  return map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2])
}

function handleConfirm() {
  if (!props.map)
    return
  const coords = getCrosshairCoordinates(props.map)
  emit('confirm', { lng: coords.lng, lat: coords.lat })
}
</script>

<template>
  <div class="location-picker">
    <Crosshair />

    <div
      class="actions"
      :style="props.actionsBottom != null ? { bottom: `${props.actionsBottom}px` } : undefined"
    >
      <button class="cancel-btn" @click="emit('cancel')">
        {{ t('tours.picker.cancelBtn') }}
      </button>
      <button class="confirm-btn" @click="handleConfirm">
        {{ t('tours.picker.confirmBtn') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.location-picker {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 200;
}

.actions {
  /* fixed so actions stay above Android system nav and Brave bottom chrome
     (parent .location-picker is absolute inside page-root 100lvh). */
  position: fixed;
  bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-md);
  pointer-events: all;
}

.cancel-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  background-color: rgba(248, 250, 252, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(203, 213, 225, 0.6);
  color: var(--color-on-surface);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: rgba(226, 232, 240, 0.9);
}

.confirm-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-md);
  transition:
    background-color 0.2s,
    transform 0.15s;
}

.confirm-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}
</style>
