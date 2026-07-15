import type { TourType } from '@/features/tours/data/models/tour-type'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Transient handoff from the calendar route to the map page. The calendar lives
 * on its own route while tour detail is overlay state on `/map`, so a selection
 * or a return-to-list must survive one navigation. Set before `router.push`,
 * consumed once in the map page's `onMounted`, then dropped — it is deliberately
 * NOT a URL param (a bare `/map` deep link carrying these flags is meaningless).
 */
export interface PendingIntent {
  /** Open the tour-list overlay on arrival (calendar back button). */
  openTours?: boolean
  /** Select this tour and open its detail on arrival. */
  selectTourId?: string
  /** Which calendar view the selection came from, so detail-back can return. */
  origin?: 'cal-seasons' | 'cal-planned'
  /** Planned-calendar dayKey the tour was opened from, so back re-opens its detail list. */
  originDay?: string
}

export const useMapStore = defineStore('map', () => {
  const isPickingLocation = ref(false)
  const currentStyleIndex = ref(0)
  const selectedTourId = ref<string | null>(null)
  /** Tentative goal coordinates shown as a lighter-tone preview marker while editing or creating a tour. */
  const previewGoal = ref<{ lng: number, lat: number } | null>(null)
  /** Activity type driving the preview marker's lighter shade; null → neutral fallback color. */
  const previewTourType = ref<TourType | null>(null)
  /** Re-picked, not-yet-saved start/end coordinates shown as lighter-tone draft detail markers. */
  const previewStart = ref<{ lng: number, lat: number } | null>(null)
  const previewEnd = ref<{ lng: number, lat: number } | null>(null)
  /** One-shot cross-route intent from the calendar (see PendingIntent). */
  const pendingIntent = ref<PendingIntent | null>(null)

  function setPendingIntent(intent: PendingIntent) {
    pendingIntent.value = intent
  }

  /** Returns the pending intent (if any) and clears it — read exactly once. */
  function consumePendingIntent(): PendingIntent | null {
    const intent = pendingIntent.value
    pendingIntent.value = null
    return intent
  }

  function setPickingLocation(picking: boolean) {
    isPickingLocation.value = picking
  }

  function setStyleIndex(index: number) {
    currentStyleIndex.value = index
  }

  function selectTour(tourId: string | null) {
    selectedTourId.value = tourId
  }

  function setPreviewGoal(goal: { lng: number, lat: number } | null) {
    previewGoal.value = goal
  }

  function setPreviewTourType(tourType: TourType | null) {
    previewTourType.value = tourType
  }

  function setPreviewStart(start: { lng: number, lat: number } | null) {
    previewStart.value = start
  }

  function setPreviewEnd(end: { lng: number, lat: number } | null) {
    previewEnd.value = end
  }

  return {
    isPickingLocation,
    currentStyleIndex,
    selectedTourId,
    previewGoal,
    previewTourType,
    previewStart,
    previewEnd,
    pendingIntent,
    setPendingIntent,
    consumePendingIntent,
    setPickingLocation,
    setStyleIndex,
    selectTour,
    setPreviewGoal,
    setPreviewTourType,
    setPreviewStart,
    setPreviewEnd,
  }
})
