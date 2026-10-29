<script setup lang="ts">
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import type { PointPick } from '@/features/tours/presentation/composables/use-swisstopo-fill'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'
import BaseButton from '@/core/components/base-button.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import { useLogger } from '@/core/logging/use-logger'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

const props = defineProps<{
  /** The latest location pick; the form looks up its name and elevation. */
  pick?: PointPick | null
  /** The goal location picked before the dialog opened (required for display). */
  initialGoal?: { lng: number, lat: number } | null
  /** Which pick is currently active — drives the collapsed header label. */
  activePickType?: 'goal' | 'start' | 'end' | null
  /** Prefilled fields — the next segment of an outing (#338), or a planned ski route. */
  seed?: TourDraft | null
  /** The seed continues an outing: titled "Add segment". */
  segment?: boolean
  /** The latest finished drawing (or a planned ski route's line) for the form to take as its track. */
  drawnTrack?: DrawnTrack | null
}>()

const emit = defineEmits<{
  confirm: [
    draft: TourDraft,
    gpxRemoved: boolean,
    preUploadedTourId: string | null,
    draftId: string,
  ]
  close: []
  pickPoint: [type: 'start' | 'end' | 'goal']
  drawTrack: [seed: DrawnTrack | null]
  trackChange: [line: LngLat[] | null]
  tourTypesChange: [tourTypes: TourType[]]
  startPointChange: [point: { lng: number, lat: number } | null]
  endPointChange: [point: { lng: number, lat: number } | null]
}>()

const { t } = useI18n({ useScope: 'global' })
const mapStore = useMapStore()
const { isPickingLocation, isDrawingTrack } = storeToRefs(mapStore)
const log = useLogger('tour-creation-dialog')
const isDesktop = useIsDesktop()

const isPicking = computed(() => isPickingLocation.value)

// On mobile, the creation form takes a full-screen page; a location pick collapses
// that page in place (never swaps it for a sheet, which would remount the form and
// drop unsaved edits, #337). `embedded` hides the in-form action row (the page top
// bar provides Save/Cancel).
const embedded = computed(() => !isDesktop.value)
const formRef = ref<{ cancel: () => void, submitBlocked: boolean } | null>(null)

function handleClose() {
  // In page mode the top-bar cancel must run the form's cleanup (orphaned GPX /
  // staged attachments); elsewhere the close path is unchanged.
  if (embedded.value)
    formRef.value?.cancel()
  else
    emit('close')
}

const pickTypeLabel = computed(() => {
  if (!isPicking.value)
    return null
  if (isDrawingTrack.value)
    return t('map.draw.title')
  if (props.activePickType === 'start')
    return t('tours.picker.startTitle')
  if (props.activePickType === 'end')
    return t('tours.picker.endTitle')
  return t('tours.picker.goalTitle')
})

const title = computed(() => pickTypeLabel.value ?? (props.segment ? t('tours.outing.addTitle') : t('tours.creation.title')))

function handleSubmit(
  draft: TourDraft,
  gpxRemoved: boolean,
  preUploadedTourId: string | null,
  draftId: string,
) {
  if (mapStore.isPickingLocation) {
    log.debug('Ignoring create submit while location picker is active')
    return
  }
  emit('confirm', draft, gpxRemoved, preUploadedTourId, draftId)
}

function handlePickPoint(type: 'start' | 'end' | 'goal') {
  emit('pickPoint', type)
}
</script>

<template>
  <AdaptiveOverlay
    :title="title"
    :collapsed="isPicking"
    page
    @close="handleClose"
  >
    <TourForm
      ref="formRef"
      form-id="tour-create-form"
      :embedded="embedded"
      :submit-label="t('tours.creation.saveBtn')"
      :allow-goal-edit="true"
      :current-goal="initialGoal ?? null"
      :initial-draft="seed"
      :pick="pick"
      :drawn-track="drawnTrack"
      :disabled="isPicking"
      @submit="(d, r, tid, did) => handleSubmit(d, r, tid, did)"
      @cancel="emit('close')"
      @pick-point="handlePickPoint"
      @draw-track="emit('drawTrack', $event)"
      @track-change="emit('trackChange', $event)"
      @tour-types-change="emit('tourTypesChange', $event)"
      @start-point-change="emit('startPointChange', $event)"
      @end-point-change="emit('endPointChange', $event)"
    />

    <template #page-action>
      <BaseButton
        type="submit" form="tour-create-form" variant="primary" size="sm"
        :disabled="formRef?.submitBlocked"
      >
        {{ t('tours.creation.saveBtn') }}
      </BaseButton>
    </template>
  </AdaptiveOverlay>
</template>
