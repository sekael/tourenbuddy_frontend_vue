import type { LngLat } from '@/features/map/domain/entities/trail'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toLngLat, toUnits } from '@/features/map/domain/track-routing'
import { useTrackDrawing } from '@/features/map/presentation/composables/use-track-drawing'

const { mockLoad, NetworkUnavailableError } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  NetworkUnavailableError: class extends Error {},
}))
vi.mock('@/features/map/data/services/trail-network-service', () => ({
  loadNetworkLines: mockLoad,
  NetworkUnavailableError,
  TooFarError: class extends Error {},
}))
vi.mock('@/features/tours/data/services/swisstopo-profile-service', () => ({ getTrackProfile: vi.fn().mockResolvedValue(null) }))

const A: LngLat = [8.42, 46.83]
const B: LngLat = [8.43, 46.83]
/** A trail from A to B over a bend north of the straight line. */
const BEND = toLngLat([(toUnits(A)[0] + toUnits(B)[0]) / 2, toUnits(A)[1] - 300])

function drawing(network: 'hiking' | 'ski' | null) {
  return useTrackDrawing({ seed: null, network: () => network, skiTemplate: async () => null })
}

describe('useTrackDrawing', () => {
  beforeEach(() => {
    mockLoad.mockReset()
  })

  it('should draw straight between points with no trail layer shown, without loading any trails', async () => {
    const d = drawing(null)
    d.add(A, 30)
    d.add(B, 30)
    await flushPromises()
    expect(d.track.value.legs).toEqual([[A, B]])
    expect(mockLoad).not.toHaveBeenCalled()
  })

  it('should draw straight and say why when the trails cannot load (offline, never cached)', async () => {
    mockLoad.mockRejectedValue(new NetworkUnavailableError())
    const d = drawing('hiking')
    d.add(A, 30)
    d.add(B, 30)
    await flushPromises()
    expect(d.track.value.legs).toEqual([[A, B]])
    expect(d.issue.value).toBe('unavailable')
  })

  it('should land a tap on the trail and follow its bend, and undo it in one step', async () => {
    mockLoad.mockResolvedValue({ key: 'k', lines: [{ points: [A, BEND, B].map(toUnits), cost: 1 }] })
    const d = drawing('hiking')
    d.add(A, 30)
    // 10 m off the trail's end: it lands on it.
    d.add([B[0], B[1] + 0.0001], 30)
    await flushPromises()
    const leg = d.track.value.legs[0]!
    expect(leg).toHaveLength(3)
    expect(leg[1]![1]).toBeCloseTo(BEND[1], 6)
    expect(d.track.value.points[1]).toEqual(leg.at(-1))
    expect(d.track.value.points[1]![0]).toBeCloseTo(B[0], 3)
    d.undo()
    expect(d.track.value.points).toHaveLength(1)
    d.redo()
    expect(d.track.value.legs).toHaveLength(1)
  })

  it('should draw straight to a tap far from any route, without a notice — straight reads as straight', async () => {
    mockLoad.mockResolvedValue({ key: 'k2', lines: [{ points: [A, BEND, B].map(toUnits), cost: 1 }] })
    const d = drawing('ski')
    d.add(A, 30)
    // ~1 km south of the route: out of reach.
    d.add([B[0], B[1] - 0.01], 30)
    await flushPromises()
    expect(d.track.value.legs[0]).toHaveLength(2)
    expect(d.issue.value).toBeNull()
  })

  it('should go back to the start the same way in one undoable step, and not twice', async () => {
    const d = drawing(null)
    d.add(A, 30)
    d.add(BEND, 30)
    d.add(B, 30)
    await flushPromises()
    d.returnToStart()
    expect(d.track.value.points).toEqual([A, BEND, B, BEND, A])
    expect(d.track.value.legs.at(-1)).toEqual([BEND, A])
    expect(d.closed.value).toBe(true)
    d.undo()
    expect(d.track.value.points).toEqual([A, BEND, B])
  })

  it('should split a leg at a point pulled out of its middle handle, both halves following the trail', async () => {
    mockLoad.mockResolvedValue({ key: 'k3', lines: [{ points: [A, BEND, B].map(toUnits), cost: 1 }] })
    const d = drawing('hiking')
    d.add(A, 30)
    d.add(B, 30)
    await flushPromises()
    // Pulled onto the bend: the new point lands there and both legs keep to the trail.
    d.dropInsert(0, [BEND[0], BEND[1] + 0.00005], 30)
    await flushPromises()
    expect(d.track.value.points).toHaveLength(3)
    expect(d.track.value.points[1]![1]).toBeCloseTo(BEND[1], 5)
    expect(d.track.value.legs).toHaveLength(2)
    expect(d.track.value.legs[1]!.at(-1)).toEqual(d.track.value.points[2])
  })
})
