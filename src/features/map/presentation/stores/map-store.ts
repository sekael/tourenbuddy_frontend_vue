import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMapStore = defineStore('map', () => {
  const isPickingLocation = ref(false)
  const currentStyleIndex = ref(0)
  const selectedTourId = ref<string | null>(null)

  function setPickingLocation(picking: boolean) {
    isPickingLocation.value = picking
  }

  function setStyleIndex(index: number) {
    currentStyleIndex.value = index
  }

  function selectTour(tourId: string | null) {
    selectedTourId.value = tourId
  }

  return {
    isPickingLocation,
    currentStyleIndex,
    selectedTourId,
    setPickingLocation,
    setStyleIndex,
    selectTour,
  }
})
