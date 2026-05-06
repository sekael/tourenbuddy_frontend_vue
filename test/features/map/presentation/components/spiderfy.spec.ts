import { describe, expect, it, vi } from 'vitest'
import { computeLeafPositions } from '@/features/map/presentation/components/spiderfy'
import { SPIDERFY_CIRCLE_RADIUS_PX, SPIDERFY_SPIRAL_THRESHOLD } from '@/features/map/presentation/components/tours-marker-layer'

describe('computeLeafPositions — circle layout', () => {
  it('should produce n=2 offsets on a circle, 180° apart', () => {
    const offsets = computeLeafPositions(2)
    expect(offsets).toHaveLength(2)
    // Both should be at SPIDERFY_CIRCLE_RADIUS_PX distance from origin
    for (const [x, y] of offsets) {
      const r = Math.sqrt(x ** 2 + y ** 2)
      expect(r).toBeCloseTo(SPIDERFY_CIRCLE_RADIUS_PX, 5)
    }
    // Angles should be 180° apart
    const angle0 = Math.atan2(offsets[0]![1], offsets[0]![0])
    const angle1 = Math.atan2(offsets[1]![1], offsets[1]![0])
    const diff = Math.abs(angle1 - angle0) % (2 * Math.PI)
    expect(diff).toBeCloseTo(Math.PI, 5)
  })

  it('should produce n=4 offsets evenly distributed (90° apart)', () => {
    const offsets = computeLeafPositions(4)
    expect(offsets).toHaveLength(4)
    // All at same radius
    for (const [x, y] of offsets) {
      const r = Math.sqrt(x ** 2 + y ** 2)
      expect(r).toBeCloseTo(SPIDERFY_CIRCLE_RADIUS_PX, 5)
    }
    // Step angle = 2π/4 = π/2
    const angles = offsets.map(([x, y]) => Math.atan2(y, x))
    const steps = angles.slice(1).map((a, i) => {
      let diff = a - angles[i]!
      if (diff < 0)
        diff += 2 * Math.PI
      return diff
    })
    for (const step of steps) {
      expect(step).toBeCloseTo(Math.PI / 2, 5)
    }
  })

  it('should produce n=8 offsets at circle threshold radius', () => {
    const offsets = computeLeafPositions(SPIDERFY_SPIRAL_THRESHOLD)
    expect(offsets).toHaveLength(SPIDERFY_SPIRAL_THRESHOLD)
    for (const [x, y] of offsets) {
      const r = Math.sqrt(x ** 2 + y ** 2)
      expect(r).toBeCloseTo(SPIDERFY_CIRCLE_RADIUS_PX, 5)
    }
  })
})

describe('computeLeafPositions — spiral layout', () => {
  it('should produce n=12 offsets with monotonically increasing radius', () => {
    const offsets = computeLeafPositions(12)
    expect(offsets).toHaveLength(12)
    const radii = offsets.map(([x, y]) => Math.sqrt(x ** 2 + y ** 2))
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]!)
    }
  })

  it('should produce n=20 offsets with monotonically increasing radius', () => {
    const offsets = computeLeafPositions(20)
    expect(offsets).toHaveLength(20)
    const radii = offsets.map(([x, y]) => Math.sqrt(x ** 2 + y ** 2))
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]!)
    }
  })

  it('should use spiral for count above threshold', () => {
    const circleOffsets = computeLeafPositions(SPIDERFY_SPIRAL_THRESHOLD)
    const spiralOffsets = computeLeafPositions(SPIDERFY_SPIRAL_THRESHOLD + 1)
    // Circle layout: all at same radius. Spiral: radii increase.
    const circleRadii = circleOffsets.map(([x, y]) => Math.sqrt(x ** 2 + y ** 2))
    const circleRVariance = Math.max(...circleRadii) - Math.min(...circleRadii)

    const spiralRadii = spiralOffsets.map(([x, y]) => Math.sqrt(x ** 2 + y ** 2))
    const spiralRVariance = Math.max(...spiralRadii) - Math.min(...spiralRadii)

    expect(circleRVariance).toBeCloseTo(0, 5)
    expect(spiralRVariance).toBeGreaterThan(0)
  })
})

describe('createSpiderfier — collapse', () => {
  it('should not throw when collapse called without active spiderfy', async () => {
    vi.mock('maplibre-gl', () => ({
      default: { Marker: vi.fn(() => ({ setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn(), getElement: vi.fn(() => document.createElement('div')) })) },
      Marker: vi.fn(),
    }))
    const { createSpiderfier } = await import(
      '@/features/map/presentation/components/spiderfy'
    )
    const stubMap = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(() => ({ setData: vi.fn() })),
      getLayer: vi.fn(() => null),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      project: vi.fn(() => ({ x: 0, y: 0 })),
      unproject: vi.fn(() => ({ lng: 8, lat: 47 })),
    } as unknown as import('maplibre-gl').Map

    const spiderfier = createSpiderfier(stubMap)
    expect(() => spiderfier.collapse()).not.toThrow()
  })
})
