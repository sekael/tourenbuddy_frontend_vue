<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import BaseMapPicker from './base-map-picker.vue'

const props = defineProps<{
  bearing?: number
}>()

const emit = defineEmits<{
  openProfile: []
  openContacts: []
  openFeedback: []
  resetBearing: []
}>()

const iconRotation = computed(() => -(props.bearing ?? 0))
const showCompass = computed(() => Math.abs(props.bearing ?? 0) > 0.5)

const mapStore = useMapStore()
const authStore = useAuthStore()
const { isPickingLocation } = storeToRefs(mapStore)
const { isAuthenticated } = storeToRefs(authStore)

function startAddTour() {
  mapStore.selectTour(null)
  mapStore.setPickingLocation(true)
}
</script>

<template>
  <div v-if="!isPickingLocation" class="overlay">
    <button v-if="showCompass" class="fab" title="Orient map north" @click="emit('resetBearing')">
      <span
        class="material-symbols-outlined compass-icon"
        :style="{ transform: `rotate(${iconRotation}deg)` }"
      >explore</span
      >
    </button>

    <button class="fab" title="Feedback" @click="emit('openFeedback')">
      <span class="material-symbols-outlined">feedback</span>
    </button>

    <button class="fab" title="Profile" @click="emit('openProfile')">
      <span class="material-symbols-outlined">account_circle</span>
    </button>

    <BaseMapPicker />

    <button class="fab" title="Contacts" @click="emit('openContacts')">
      <span class="material-symbols-outlined">group</span>
    </button>

    <button
      class="fab"
      :disabled="!isAuthenticated"
      :title="isAuthenticated ? 'Add tour location' : 'Sign in to add tours'"
      @click="startAddTour"
    >
      <span class="material-symbols-outlined">add_location_alt</span>
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
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: rgba(248, 250, 252, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(203, 213, 225, 0.5);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition:
    box-shadow 0.2s,
    opacity 0.2s,
    transform 0.15s;
}

.fab:hover:not(:disabled) {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.fab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.compass-icon {
  transition: transform 0.15s ease-out;
}
</style>
