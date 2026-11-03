import type { LngLat } from '@/features/map/domain/entities/trail'
import { describe, expect, it, vi } from 'vitest'
import { toLngLat, toUnits } from '@/features/map/domain/track-routing'
import { useLegRouter } from '@/features/map/presentation/composables/use-leg-router'

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }))
vi.mock('@/features/map/data/services/trail-network-service', () => ({
  loadNetworkLines: mockLoad,
  TooFarError: class extends Error {},
}))

const A: LngLat = [8.42, 46.83]
/** A trail ~1.5 km east of A, ending ~500 m below a summit. */
const END = toLngLat([toUnits(A)[0] + 1500, toUnits(A)[1]])
const SUMMIT = toLngLat([toUnits(END)[0], toUnits(END)[1] - 500])

describe('useLegRouter', () => {
  it('should follow the trail as far as it goes to a summit off it, then go straight up', async () => {
    mockLoad.mockResolvedValue({ key: 'trail', lines: [{ points: [A, END].map(toUnits), cost: 1 }] })
    const router = useLegRouter({ network: () => 'hiking', skiTemplate: async () => null })
    const leg = await router.between(A, SUMMIT, 250)
    expect(leg.length).toBeGreaterThan(2)
    expect(leg.at(-1)).toEqual(SUMMIT)
    expect(leg.at(-2)![0]).toBeCloseTo(END[0], 4)
  })
})
