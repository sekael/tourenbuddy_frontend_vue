<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
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

const { t } = useI18n({ useScope: 'global' })

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
  <AdaptiveOverlay :title="t('tours.creation.title')" @close="emit('close')">
    <TourForm
      :submit-label="t('tours.creation.saveBtn')"
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
  </AdaptiveOverlay>
</template>
