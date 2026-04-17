import { describe, expect, it } from 'vitest'
import { tourRowSchema } from '@/features/tours/data/models/tour-schema'

const baseRow = {
  id: 'tour-1',
  user_id: 'user-1',
  planned_date: null,
  lon: 8.2,
  lat: 46.8,
  name: 'Test Tour',
  partner_ids: [],
}

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
