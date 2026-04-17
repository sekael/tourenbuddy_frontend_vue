import { describe, expect, it } from 'vitest'
import {
  TOUR_TYPE_COLORS,
  TOUR_TYPE_PREVIEW_COLORS,
  TOUR_TYPE_VALUES,
} from '@/features/tours/data/models/tour-type'

describe('tour type colors', () => {
  it('should cover every TOUR_TYPE_VALUES entry with TOUR_TYPE_COLORS', () => {
    for (const type of TOUR_TYPE_VALUES) {
      expect(TOUR_TYPE_COLORS[type]).toBeDefined()
      expect(TOUR_TYPE_COLORS[type]).toMatch(/^#[\dA-F]{6}$/i)
    }
  })

  it('should cover every TOUR_TYPE_VALUES entry with TOUR_TYPE_PREVIEW_COLORS', () => {
    for (const type of TOUR_TYPE_VALUES) {
      expect(TOUR_TYPE_PREVIEW_COLORS[type]).toBeDefined()
      expect(TOUR_TYPE_PREVIEW_COLORS[type]).toMatch(/^#[\dA-F]{6}$/i)
    }
  })
})
