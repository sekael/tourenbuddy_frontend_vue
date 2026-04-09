<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import Crosshair from '@/core/components/crosshair.vue'

const props = defineProps<{
  map: MapLibreMap | null
}>()

const emit = defineEmits<{
  confirm: [location: { lng: number, lat: number }]
  cancel: []
}>()

function handleConfirm() {
  if (!props.map)
    return
  const center = props.map.getCenter()
  emit('confirm', { lng: center.lng, lat: center.lat })
}
</script>

<template>
  <div class="location-picker">
    <Crosshair />

    <div class="actions">
      <button class="cancel-btn" @click="emit('cancel')">
        Cancel
      </button>
      <button class="confirm-btn" @click="handleConfirm">
        Continue
      </button>
    </div>
  </div>
</template>

<style scoped>
.location-picker {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.actions {
  position: absolute;
  bottom: var(--spacing-xxl);
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
  border-radius: 12px;
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
  border-radius: 12px;
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
