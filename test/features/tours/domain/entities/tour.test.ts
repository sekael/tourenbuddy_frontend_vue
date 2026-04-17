import type { Tour } from '@/features/tours/domain/entities/tour'
import { describe, expect, it } from 'vitest'
import { toursToGeoJson, tourToGeoJsonFeature } from '@/features/tours/domain/entities/tour'

const baseTour: Tour = {
  id: 'tour-1',
  userId: 'user-1',
  plannedDate: null,
  goal: { lng: 8.2, lat: 46.8 },
  name: 'Rigi',
  partnerIds: [],
  tourType: 'hiking',
  elevation: null,
  gpxTrack: null,
  description: null,
  seasons: null,
  startPoint: null,
  endPoint: null,
  equipment: null,
  notes: null,
  completed: false,
}

describe('tourToGeoJsonFeature', () => {
  it('should include completed: false in feature properties', () => {
    const feature = tourToGeoJsonFeature(baseTour)
    expect(feature.properties?.completed).toBe(false)
  })

  it('should include completed: true in feature properties', () => {
    const feature = tourToGeoJsonFeature({ ...baseTour, completed: true })
    expect(feature.properties?.completed).toBe(true)
  })
})

describe('toursToGeoJson', () => {
  it('should map completed property for each feature', () => {
    const tours: Tour[] = [
      { ...baseTour, id: 'a', completed: false },
      { ...baseTour, id: 'b', completed: true },
    ]
    const collection = toursToGeoJson(tours)
    expect(collection.features[0]?.properties?.completed).toBe(false)
    expect(collection.features[1]?.properties?.completed).toBe(true)
  })
})
