import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMapStore = defineStore('map', () => {
  const isPickingLocation = ref(false)
  const currentStyleIndex = ref(0)
  const selectedTourId = ref<string | null>(null)
  /** Tentative goal coordinates shown as an orange preview marker while editing a tour. */
  const editPreviewGoal = ref<{ lng: number; lat: number } | null>(null)

  function setPickingLocation(picking: boolean) {
    isPickingLocation.value = picking
  }

  function setStyleIndex(index: number) {
    currentStyleIndex.value = index
  }

  function selectTour(tourId: string | null) {
    selectedTourId.value = tourId
  }

  function setEditPreviewGoal(goal: { lng: number; lat: number } | null) {
    editPreviewGoal.value = goal
  }

  return {
    isPickingLocation,
    currentStyleIndex,
    selectedTourId,
    editPreviewGoal,
    setPickingLocation,
    setStyleIndex,
    selectTour,
    setEditPreviewGoal,
  }
})
