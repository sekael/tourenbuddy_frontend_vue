<script setup lang="ts">
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import { useLogger } from '@/core/logging/use-logger'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

const props = defineProps<{
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
  pickPoint: [type: 'start' | 'end' | 'goal']
}>()

const { t } = useI18n({ useScope: 'global' })
const mapStore = useMapStore()
const { isPickingLocation } = storeToRefs(mapStore)
const log = useLogger('tour-creation-dialog')

const isPicking = computed(() => isPickingLocation.value)

const title = computed(() =>
  isPicking.value
    ? t('tours.creation.pickingTitle', { name: props.initialName ?? t('tours.creation.title') })
    : t('tours.creation.title'),
)

function handleSubmit(draft: TourDraft) {
  if (mapStore.isPickingLocation) {
    log.debug('Ignoring create submit while location picker is active')
    return
  }
  emit('confirm', draft)
}

function handlePickPoint(type: 'start' | 'end' | 'goal') {
  emit('pickPoint', type)
}
</script>

<template>
  <AdaptiveOverlay :title="title" :collapsed="isPicking" @close="emit('close')">
    <TourForm
      :submit-label="t('tours.creation.saveBtn')"
      :allow-goal-edit="true"
      :current-goal="initialGoal ?? null"
      :initial-elevation="initialElevation"
      :initial-name="initialName"
      :initial-start-point="initialStartPoint"
      :initial-end-point="initialEndPoint"
      :disabled="isPicking"
      @submit="handleSubmit"
      @cancel="emit('close')"
      @pick-point="handlePickPoint"
    />
  </AdaptiveOverlay>
</template>
