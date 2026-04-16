<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

defineProps<{
  /** Pre-filled elevation from Swisstopo lookup. */
  initialElevation?: number | null
  /** Pre-filled name suggestion from Swisstopo. */
  initialName?: string | null
  /** Pre-filled start point from secondary location pick. */
  initialStartPoint?: { lng: number; lat: number } | null
  /** Pre-filled end point from secondary location pick. */
  initialEndPoint?: { lng: number; lat: number } | null
  /** The goal location picked before the dialog opened (required for display). */
  initialGoal?: { lng: number; lat: number } | null
}>()

const emit = defineEmits<{
  confirm: [draft: TourDraft]
  close: []
  pickPoint: [type: 'start' | 'end']
}>()

function handleSubmit(draft: TourDraft) {
  emit('confirm', draft)
}

function handlePickPoint(type: 'start' | 'end' | 'goal') {
  if (type === 'start' || type === 'end') {
    emit('pickPoint', type)
  }
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <div class="dialog">
      <div class="header">
        <h2 class="title">New Tour</h2>
        <button class="close-btn" aria-label="Close" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <TourForm
        submit-label="Save Tour"
        :allow-goal-edit="false"
        :current-goal="initialGoal ?? null"
        :initial-elevation="initialElevation"
        :initial-name="initialName"
        :initial-start-point="initialStartPoint"
        :initial-end-point="initialEndPoint"
        @submit="handleSubmit"
        @cancel="emit('close')"
        @pick-point="handlePickPoint"
      />
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}

.dialog {
  background-color: var(--color-background);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  max-height: 85dvh;
}

@media (min-width: 600px) {
  .dialog {
    border-radius: var(--radius-lg);
    max-height: 90dvh;
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md);
  flex-shrink: 0;
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
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
}

.close-btn:hover {
  background-color: var(--color-surface-variant);
}
</style>
