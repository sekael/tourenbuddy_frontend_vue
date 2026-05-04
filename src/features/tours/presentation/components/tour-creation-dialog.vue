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
  initialStartPoint?: { lng: number, lat: number } | null
  /** Pre-filled end point from secondary location pick. */
  initialEndPoint?: { lng: number, lat: number } | null
  /** The goal location picked before the dialog opened (required for display). */
  initialGoal?: { lng: number, lat: number } | null
  /** Metadata fetched after start-point pick: name + elevation. */
  initialStartPointMeta?: { name: string | null, elevation: number | null } | null
  /** Metadata fetched after end-point pick: name + elevation. */
  initialEndPointMeta?: { name: string | null, elevation: number | null } | null
  /** Which pick is currently active — drives the collapsed header label. */
  activePickType?: 'goal' | 'start' | 'end' | null
}>()

const emit = defineEmits<{
  confirm: [draft: TourDraft, gpxFile: File | null, gpxRemoved: boolean, preUploadedTourId: string | null]
  close: []
  pickPoint: [type: 'start' | 'end' | 'goal']
}>()

const { t } = useI18n({ useScope: 'global' })
const mapStore = useMapStore()
const { isPickingLocation } = storeToRefs(mapStore)
const log = useLogger('tour-creation-dialog')

const isPicking = computed(() => isPickingLocation.value)

const pickTypeLabel = computed(() => {
  if (!isPicking.value)
    return null
  if (props.activePickType === 'start')
    return t('tours.picker.startTitle')
  if (props.activePickType === 'end')
    return t('tours.picker.endTitle')
  return t('tours.picker.goalTitle')
})

const title = computed(() => pickTypeLabel.value ?? t('tours.creation.title'))

function handleSubmit(draft: TourDraft, gpxFile: File | null, gpxRemoved: boolean, preUploadedTourId: string | null) {
  if (mapStore.isPickingLocation) {
    log.debug('Ignoring create submit while location picker is active')
    return
  }
  emit('confirm', draft, gpxFile, gpxRemoved, preUploadedTourId)
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
      :initial-start-point-meta="initialStartPointMeta"
      :initial-end-point-meta="initialEndPointMeta"
      :disabled="isPicking"
      @submit="(d, f, r, tid) => handleSubmit(d, f, r, tid)"
      @cancel="emit('close')"
      @pick-point="handlePickPoint"
    />
  </AdaptiveOverlay>
</template>
