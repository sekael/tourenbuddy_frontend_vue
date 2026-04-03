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
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.cancel-btn:hover {
  background-color: var(--color-surface-variant);
}

.confirm-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.confirm-btn:hover {
  background-color: var(--color-primary-dark);
}
</style>
