import { describe, expect, it } from 'vitest'
import { darkenHex } from '@/core/utils/color'
import { TOUR_TYPE_COLORS, TOUR_TYPE_TRACK_COLORS } from '@/features/tours/data/models/tour-type'

function hexToLightness(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

describe('tOUR_TYPE_TRACK_COLORS', () => {
  it('should have an entry for every TOUR_TYPE_COLORS key', () => {
    for (const type of Object.keys(TOUR_TYPE_COLORS)) {
      expect(TOUR_TYPE_TRACK_COLORS).toHaveProperty(type)
    }
  })

  it('track color should be darker than marker color for every tour type', () => {
    for (const [type, markerColor] of Object.entries(TOUR_TYPE_COLORS)) {
      const trackColor = TOUR_TYPE_TRACK_COLORS[type as keyof typeof TOUR_TYPE_TRACK_COLORS]
      expect(hexToLightness(trackColor)).toBeLessThan(hexToLightness(markerColor))
    }
  })

  it('track colors should be approximately 18pp darker than marker colors', () => {
    for (const [type, markerColor] of Object.entries(TOUR_TYPE_COLORS)) {
      const expected = darkenHex(markerColor, 18)
      const actual = TOUR_TYPE_TRACK_COLORS[type as keyof typeof TOUR_TYPE_TRACK_COLORS]
      const diffL = Math.abs(hexToLightness(actual) - hexToLightness(expected))
      expect(diffL).toBeLessThan(0.02)
    }
  })
})
