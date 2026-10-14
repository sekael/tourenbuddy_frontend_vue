import type { LngLat, Map as MapLibreMap, Point } from 'maplibre-gl'
import type { Trail } from '@/features/map/domain/entities/trail'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { identifySkiRoutes } from '@/features/map/data/services/swisstopo-trail-service'
import { useTrailLookup } from '@/features/map/presentation/composables/use-trail-lookup'

vi.mock('@/features/map/data/services/swisstopo-trail-service', () => ({ identifySkiRoutes: vi.fn() }))

// Screen px = lng/lat as-is, so a trail at x = n lies n px right of a tap at the origin.
const map = {
  getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 1, getNorth: () => 1 }),
  getContainer: () => ({ clientWidth: 400, clientHeight: 800 }),
  project: ([x, y]: [number, number]) => ({ x, y }),
} as unknown as MapLibreMap
const TAP = { x: 0, y: 0 } as Point
const AT = { lng: 0, lat: 0 } as LngLat

const trailAt = (x: number): Trail => ({ overlay: 'ski', id: `t${x}`, lines: [[[x, -1], [x, 1]]], route: null })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useTrailLookup', () => {
  const onError = vi.fn()
  const lookup = () => useTrailLookup({ map: () => map, locale: () => 'en', onError })

  beforeEach(() => {
    vi.mocked(identifySkiRoutes).mockReset()
    onError.mockReset()
  })

  it('should drop an older response that arrives after a newer tap', async () => {
    const first = deferred<Trail[]>()
    vi.mocked(identifySkiRoutes).mockReturnValueOnce(first.promise).mockResolvedValueOnce([trailAt(2)])
    const { lookup: run } = lookup()

    const older = run(TAP, AT)
    const newer = await run(TAP, AT)
    first.resolve([trailAt(1)])

    expect(await older).toBeNull()
    expect(newer?.candidates.map(c => c.id)).toEqual(['t2'])
  })

  it('should not report the abort of a superseded request as an error', async () => {
    vi.mocked(identifySkiRoutes)
      .mockImplementationOnce(({ signal }) => new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
      .mockResolvedValueOnce([])
    const { lookup: run } = lookup()

    const older = run(TAP, AT)
    await run(TAP, AT)

    expect(await older).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it('should report a failed lookup once and resolve null', async () => {
    vi.mocked(identifySkiRoutes).mockRejectedValueOnce(new Error('HTTP 500'))
    expect(await lookup().lookup(TAP, AT)).toBeNull()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('should cap at eight nearest candidates and count the rest', async () => {
    vi.mocked(identifySkiRoutes).mockResolvedValueOnce([12, 3, 7, 1, 9, 11, 2, 5, 10, 4, 8, 6].map(trailAt))
    const hits = await lookup().lookup(TAP, AT)
    expect(hits?.candidates.map(c => c.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'])
    expect(hits?.more).toBe(4)
  })
})
