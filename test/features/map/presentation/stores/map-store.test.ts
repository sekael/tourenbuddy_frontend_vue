import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

describe('useMapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start with default state', () => {
    const store = useMapStore()
    expect(store.isPickingLocation).toBe(false)
    expect(store.currentStyleIndex).toBe(0)
    expect(store.selectedTourId).toBeNull()
  })

  it('should enter location picking mode', () => {
    const store = useMapStore()
    store.setPickingLocation(true)
    expect(store.isPickingLocation).toBe(true)
  })

  it('should preserve selected tour when entering location picking mode', () => {
    const store = useMapStore()
    store.selectTour('tour-123')
    store.setPickingLocation(true)
    expect(store.selectedTourId).toBe('tour-123')
  })

  it('should exit location picking mode', () => {
    const store = useMapStore()
    store.setPickingLocation(true)
    store.setPickingLocation(false)
    expect(store.isPickingLocation).toBe(false)
  })

  it('should update style index', () => {
    const store = useMapStore()
    store.setStyleIndex(1)
    expect(store.currentStyleIndex).toBe(1)
  })

  it('should select a tour', () => {
    const store = useMapStore()
    store.selectTour('tour-abc')
    expect(store.selectedTourId).toBe('tour-abc')
  })

  it('should deselect a tour', () => {
    const store = useMapStore()
    store.selectTour('tour-abc')
    store.selectTour(null)
    expect(store.selectedTourId).toBeNull()
  })

  describe('preview marker state', () => {
    it('should start with no preview goal or type', () => {
      const store = useMapStore()
      expect(store.previewGoal).toBeNull()
      expect(store.previewTourType).toBeNull()
    })

    it('should clear the preview goal back to null', () => {
      const store = useMapStore()
      store.setPreviewGoal({ lng: 8.2, lat: 46.8 })
      store.setPreviewGoal(null)
      expect(store.previewGoal).toBeNull()
    })

    it('should clear the preview tour type back to null', () => {
      const store = useMapStore()
      store.setPreviewTourType('skitour')
      store.setPreviewTourType(null)
      expect(store.previewTourType).toBeNull()
    })

    it('should keep preview goal and type independent of tour selection', () => {
      const store = useMapStore()
      store.setPreviewGoal({ lng: 8.2, lat: 46.8 })
      store.setPreviewTourType('hiking')
      store.selectTour('tour-xyz')
      store.selectTour(null)
      expect(store.previewGoal).toEqual({ lng: 8.2, lat: 46.8 })
      expect(store.previewTourType).toBe('hiking')
    })
  })
})
