<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import BaseMapPicker from './base-map-picker.vue'

const emit = defineEmits<{
  openProfile: []
  openAddContact: []
}>()

const mapStore = useMapStore()
const authStore = useAuthStore()
const { isPickingLocation } = storeToRefs(mapStore)
const { isAuthenticated } = storeToRefs(authStore)
</script>

<template>
  <div v-if="!isPickingLocation" class="overlay">
    <BaseMapPicker />

    <button class="fab" title="Profile" @click="emit('openProfile')">
      👤
    </button>

    <button class="fab" title="Add Contact" @click="emit('openAddContact')">
      ➕👤
    </button>

    <button
      class="fab"
      :disabled="!isAuthenticated"
      :title="isAuthenticated ? 'Add tour location' : 'Sign in to add tours'"
      @click="mapStore.setPickingLocation(true)"
    >
      📍
    </button>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  bottom: var(--spacing-xxl);
  right: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
  z-index: 10;
}

.fab {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition:
    box-shadow 0.2s,
    opacity 0.2s;
}

.fab:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.fab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
