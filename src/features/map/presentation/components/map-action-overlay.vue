<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import { useLogger } from '@/core/logging/use-logger'
import BaseMapPicker from './base-map-picker.vue'

const emit = defineEmits<{
  openProfile: []
  openAddContact: []
}>()

const mapStore = useMapStore()
const authStore = useAuthStore()
const { isPickingLocation } = storeToRefs(mapStore)
const { isAuthenticated } = storeToRefs(authStore)

const logger = useLogger('map-action-overlay')
const showFeedbackSheet = ref(false)

const GITHUB_ISSUE_URL
  = 'https://github.com/sekael/touringbuddy_frontend/issues/new?template=beta_feedback.yml',

function openGithubIssue() {
  logger.info('Opening Github issue URL', GITHUB_ISSUE_URL)
  window.open(GITHUB_ISSUE_URL, '_blank', 'noopener,noreferrer')
  showFeedbackSheet.value = false
}
</script>

<template>
  <div v-if="!isPickingLocation" class="overlay">
    <button class="fab" title="Feedback" @click="showFeedbackSheet = true">
      <span class="material-symbols-outlined">feedback</span>
    </button>

    <button class="fab" title="Profile" @click="emit('openProfile')">
      <span class="material-symbols-outlined">person</span>
    </button>

    <BaseMapPicker />

    <button class="fab" title="Add Contact" @click="emit('openAddContact')">
      <span class="material-symbols-outlined">person_add</span>
    </button>

    <button
      class="fab"
      :disabled="!isAuthenticated"
      :title="isAuthenticated ? 'Add tour location' : 'Sign in to add tours'"
      @click="mapStore.setPickingLocation(true)"
    >
      <span class="material-symbols-outlined">add_location_alt</span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="showFeedbackSheet"
      class="feedback-backdrop"
      @click.self="showFeedbackSheet = false"
    >
      <div class="feedback-sheet" role="dialog" aria-modal="true" aria-label="Feedback">
        <button type="button" class="feedback-primary" @click="openGithubIssue">
          Open Issue on GitHub
        </button>
        <p class="feedback-hint">
          If you don't have a GitHub account, you can always reach out to us at
          <a href="mailto:feedback@tourenbuddy.ch">feedback@tourenbuddy.ch</a>
        </p>
        <button type="button" class="feedback-close" @click="showFeedbackSheet = false">
          Close
        </button>
      </div>
    </div>
  </Teleport>
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

.feedback-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.feedback-sheet {
  width: 100%;
  max-width: 480px;
  background-color: var(--color-surface, #fff);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-lg);
}

.feedback-primary {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.feedback-primary:hover {
  filter: brightness(1.05);
}

.feedback-hint {
  text-align: center;
  font-size: 0.9rem;
  color: var(--color-on-surface-variant);
  margin: 0;
}

.feedback-hint a {
  color: var(--color-primary);
}

.feedback-close {
  background: none;
  border: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  padding: var(--spacing-sm);
}
</style>
