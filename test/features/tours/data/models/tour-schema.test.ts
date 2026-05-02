import { describe, expect, it } from 'vitest'
import { tourRowSchema, tourSchema } from '@/features/tours/data/models/tour-schema'

const baseRow = {
  id: 'tour-1',
  user_id: 'user-1',
  planned_date: null,
  lon: 8.2,
  lat: 46.8,
  name: 'Test Tour',
  partner_ids: [],
}

describe('tourSchema invariant: no partner snapshots', () => {
  it('should contain partnerIds but no partner name or phone fields', () => {
    const shape = tourSchema.shape
    expect(shape).toHaveProperty('partnerIds')
    expect(shape).not.toHaveProperty('partnerNames')
    expect(shape).not.toHaveProperty('partnerPhones')
    expect(shape).not.toHaveProperty('partners')
    expect(shape).not.toHaveProperty('partnerFirstNames')
    expect(shape).not.toHaveProperty('partnerLastNames')
    expect(shape).not.toHaveProperty('partnerDisplayNames')
    expect(shape).not.toHaveProperty('partnerContactMethods')
  })
})

describe('tourRowSchema: start/end point metadata fields', () => {
  it('should default new metadata fields to null when absent (legacy row)', () => {
    const result = tourRowSchema.parse(baseRow)
    expect(result.startPointName).toBeNull()
    expect(result.startPointElevation).toBeNull()
    expect(result.endPointName).toBeNull()
    expect(result.endPointElevation).toBeNull()
  })

  it('should parse all four metadata fields when present', () => {
    const result = tourRowSchema.parse({
      ...baseRow,
      start_point_name: 'Grindelwald',
      start_point_elevation: 1034,
      end_point_name: 'Kleine Scheidegg',
      end_point_elevation: 2061,
    })
    expect(result.startPointName).toBe('Grindelwald')
    expect(result.startPointElevation).toBe(1034)
    expect(result.endPointName).toBe('Kleine Scheidegg')
    expect(result.endPointElevation).toBe(2061)
  })

  it('should accept null values for all four metadata fields', () => {
    const result = tourRowSchema.parse({
      ...baseRow,
      start_point_name: null,
      start_point_elevation: null,
      end_point_name: null,
      end_point_elevation: null,
    })
    expect(result.startPointName).toBeNull()
    expect(result.startPointElevation).toBeNull()
    expect(result.endPointName).toBeNull()
    expect(result.endPointElevation).toBeNull()
  })
})

describe('tourRowSchema completed field', () => {
  it('should default completed to false when field is absent', () => {
    const result = tourRowSchema.parse(baseRow)
    expect(result.completed).toBe(false)
  })

  it('should parse completed as true when set', () => {
    const result = tourRowSchema.parse({ ...baseRow, completed: true })
    expect(result.completed).toBe(true)
  })

  it('should parse completed as false when explicitly false', () => {
    const result = tourRowSchema.parse({ ...baseRow, completed: false })
    expect(result.completed).toBe(false)
  })
})
