import { describe, expect, it } from 'vitest'
import { buildClusterProperties } from '@/features/map/presentation/components/tours-marker-layer'
import { TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'

describe('buildClusterProperties', () => {
  it('should include an aggregation entry for every TourType value', () => {
    const props = buildClusterProperties()
    for (const type of TOUR_TYPE_VALUES) {
      expect(props).toHaveProperty(type)
    }
  })

  it('should include an unknown bucket', () => {
    const props = buildClusterProperties()
    expect(props).toHaveProperty('unknown')
  })

  it('should produce one entry per TourType plus unknown', () => {
    const props = buildClusterProperties()
    expect(Object.keys(props)).toHaveLength(TOUR_TYPE_VALUES.length + 1)
  })

  it('should use ["+", ...] aggregation expressions', () => {
    const props = buildClusterProperties()
    for (const value of Object.values(props)) {
      expect(Array.isArray(value)).toBe(true)
      expect((value as unknown[])[0]).toBe('+')
    }
  })
})
