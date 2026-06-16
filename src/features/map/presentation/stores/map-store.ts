import type { TourType } from '@/features/tours/data/models/tour-type'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMapStore = defineStore('map', () => {
  const isPickingLocation = ref(false)
  const currentStyleIndex = ref(0)
  const selectedTourId = ref<string | null>(null)
  /** Tentative goal coordinates shown as a lighter-tone preview marker while editing or creating a tour. */
  const previewGoal = ref<{ lng: number, lat: number } | null>(null)
  /** Activity type driving the preview marker's lighter shade; null → neutral fallback color. */
  const previewTourType = ref<TourType | null>(null)

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

  return {
    isPickingLocation,
    currentStyleIndex,
    selectedTourId,
    previewGoal,
    previewTourType,
    setPickingLocation,
    setStyleIndex,
    selectTour,
    setPreviewGoal,
    setPreviewTourType,
  }
})
