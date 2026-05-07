import type { PaletteMap } from '@/features/map/presentation/components/pie-marker'
import { describe, expect, it } from 'vitest'
import { buildSlices } from '@/features/map/presentation/components/pie-marker'

const PALETTE: PaletteMap = {
  'skiing': '#1565C0',
  'snowboarding': '#1565C0',
  'skitour': '#1565C0',
  'splitboarding': '#1565C0',
  'ski-mountaineering': '#1565C0',
  'paragliding': '#D97706',
  'hiking': '#DC2626',
  'mountaineering': '#DC2626',
  'climbing': '#DC2626',
  'mountain-biking': '#DC2626',
  'trailrunning': '#DC2626',
}

describe('buildSlices', () => {
  it('should return empty array when total is 0', () => {
    const counts = { skiing: 0, hiking: 0 }
    expect(buildSlices(counts, 0, PALETTE)).toEqual([])
  })

  it('should return empty array when all counts are 0 even with positive total', () => {
    const counts = { skiing: 0 }
    expect(buildSlices(counts, 0, PALETTE)).toEqual([])
  })

  it('should return a single full-circle path for single type', () => {
    const counts = { hiking: 3 }
    const slices = buildSlices(counts, 3, PALETTE)
    expect(slices).toHaveLength(1)
    expect(slices[0]!.color).toBe('#DC2626')
    // Full circle uses arc notation not straight path
    expect(slices[0]!.path).toContain('a')
  })

  it('should return two slices for two equal types summing to 360°', () => {
    const counts = { skiing: 2, hiking: 2 }
    const slices = buildSlices(counts, 4, PALETTE)
    expect(slices).toHaveLength(2)
    // Each slice is 180° (half circle)
    for (const slice of slices) {
      expect(slice.path).toBeTruthy()
    }
  })

  it('should return three slices for three unequal types', () => {
    const counts = { skiing: 1, hiking: 2, paragliding: 1 }
    const slices = buildSlices(counts, 4, PALETTE)
    expect(slices).toHaveLength(3)
    // Angles should be proportional: 90°, 180°, 90°
  })

  it('should assign fallback color for unknown type not in palette', () => {
    const counts: Record<string, number> = { unknown: 2 }
    const slices = buildSlices(counts, 2, PALETTE)
    expect(slices).toHaveLength(1)
    expect(slices[0]!.color).toBe('#78716C')
  })
})
