import type { Map as MapLibreMap, Point } from 'maplibre-gl'
import type { Trail } from '@/features/map/domain/entities/trail'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { identifySkiRoutes } from '@/features/map/data/services/swisstopo-trail-service'
import { useTrailLookup } from '@/features/map/presentation/composables/use-trail-lookup'

vi.mock('@/features/map/data/services/swisstopo-trail-service', () => ({ identifySkiRoutes: vi.fn() }))

// Screen px = lng/lat as-is, so a trail at x = n lies n px right of a tap at the origin.
let view = [0, 0, 1, 1]
const map = {
  getBounds: () => ({ getWest: () => view[0], getSouth: () => view[1], getEast: () => view[2], getNorth: () => view[3] }),
  getContainer: () => ({ clientWidth: 400, clientHeight: 800 }),
  project: ([x, y]: [number, number]) => ({ x, y }),
} as unknown as MapLibreMap
const TAP = { x: 0, y: 0 } as Point
const INFO = { name: null, targetName: 'Peak', targetAltitude: null, difficulty: null, ascentTime: null, ascentM: null, descentM: null, sacUrl: null }

const trailAt = (x: number, route: Trail['route'] = INFO): Trail => ({ overlay: 'ski', id: `t${x}`, lines: [[[x, -1], [x, 1]]], route })

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useTrailLookup', () => {
  const onError = vi.fn()
  const create = () => useTrailLookup({ map: () => map, locale: () => 'en', onError })

  beforeEach(() => {
    view = [0, 0, 1, 1]
    vi.mocked(identifySkiRoutes).mockReset()
    onError.mockReset()
  })

  it('should never apply a load superseded by a newer view', async () => {
    const first = deferred<Trail[]>()
    vi.mocked(identifySkiRoutes).mockReturnValueOnce(first.promise).mockResolvedValueOnce([trailAt(2)])
    const lookup = create()

    const older = lookup.refresh()
    view = [5, 5, 6, 6]
    await lookup.refresh()
    first.resolve([trailAt(1)])

    expect(await older).toBe('stale')
    expect(lookup.trails.value.map(t => t.id)).toEqual(['t2'])
  })

  it('should not refetch while the view stays inside the loaded extent', async () => {
    vi.mocked(identifySkiRoutes).mockResolvedValue([])
    const lookup = create()
    await lookup.refresh()
    view = [0.2, 0.2, 0.8, 0.8]
    await lookup.refresh()
    expect(identifySkiRoutes).toHaveBeenCalledOnce()
  })

  it('should make routes without route info unclickable', async () => {
    vi.mocked(identifySkiRoutes).mockResolvedValueOnce([trailAt(1, null), trailAt(2)])
    const hits = await create().lookup(TAP)
    expect(hits?.candidates.map(c => c.id)).toEqual(['t2'])
  })

  it('should report a failed load on tap, not on a background refresh', async () => {
    vi.mocked(identifySkiRoutes).mockRejectedValue(new Error('HTTP 500'))
    const lookup = create()
    expect(await lookup.refresh()).toBe('error')
    expect(onError).not.toHaveBeenCalled()
    expect(await lookup.lookup(TAP)).toBeNull()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('should ignore routes beyond the tap tolerance', async () => {
    vi.mocked(identifySkiRoutes).mockResolvedValueOnce([trailAt(5), trailAt(40)])
    const hits = await create().lookup(TAP)
    expect(hits?.candidates.map(c => c.id)).toEqual(['t5'])
  })

  it('should cap at eight nearest candidates and count the rest', async () => {
    vi.mocked(identifySkiRoutes).mockResolvedValueOnce([10, 3, 7, 1, 9, 11, 2, 5, 12, 4, 8, 6].map(x => trailAt(x)))
    const hits = await create().lookup(TAP)
    expect(hits?.candidates.map(c => c.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'])
    expect(hits?.more).toBe(2)
  })
})
