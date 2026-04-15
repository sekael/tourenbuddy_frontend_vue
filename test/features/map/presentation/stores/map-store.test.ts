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
})
