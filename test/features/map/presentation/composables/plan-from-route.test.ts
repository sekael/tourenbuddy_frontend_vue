import type { LngLat, SkiRouteInfo } from '@/features/map/domain/entities/trail'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planFromRoute, routeLine } from '@/features/map/presentation/composables/plan-from-route'

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))
vi.mock('@/features/map/data/services/swisstopo-search-service', () => ({ searchLocations: mockSearch }))

const ROUTE: SkiRouteInfo = {
  name: 'Von Habkern',
  targetName: 'Furggegütsch (Hohgant)',
  targetAltitude: 2197,
  difficulty: 'WS',
  ascentTime: '03:30 h',
  ascentM: 1100,
  descentM: 1100,
  sacUrl: 'https://www.sac-cas.ch/x',
}
/** A two-part route whose last point is a valley variant, not the summit. */
const LINES: LngLat[][] = [[[7.85, 46.76], [7.88, 46.78]], [[7.88, 46.78], [7.83, 46.74]]]
const place = (name: string, lng: number, lat: number) => ({ name, lng, lat, kind: null, region: null, origin: 'gazetteer', objectclass: null, zoom: 14 })

describe('planFromRoute', () => {
  beforeEach(() => {
    mockSearch.mockReset()
  })

  it('should put the goal on the summit found by name near the route, not on the route\'s last point', async () => {
    mockSearch.mockResolvedValue([place('Furggegütsch', 9.0, 46.0), place('Furggegütsch', 7.8801, 46.7801), place('Hohgant', 7.88, 46.78)])
    const plan = await planFromRoute(ROUTE, LINES, 'de-CH')
    expect(mockSearch).toHaveBeenCalledWith('Furggegütsch', 'de-CH', expect.any(AbortSignal))
    expect(plan!.goal).toEqual({ lng: 7.8801, lat: 46.7801 })
    // The start is the route end farthest from the summit.
    expect(plan!.seed).toMatchObject({
      name: 'Furggegütsch (Hohgant)',
      elevation: 2197,
      tourTypes: ['skitour'],
      grade: 'WS',
      startPoint: { lng: 7.83, lat: 46.74 },
      description: 'Von Habkern\nhttps://www.sac-cas.ch/x',
    })
  })

  it('should fall back to the route\'s last point without a match nearby or without the search', async () => {
    mockSearch.mockResolvedValue([place('Furggegütsch', 9.0, 46.0)])
    expect((await planFromRoute(ROUTE, LINES, 'en'))!.goal).toEqual({ lng: 7.83, lat: 46.74 })
    mockSearch.mockRejectedValue(new TypeError('offline'))
    const offline = await planFromRoute(ROUTE, LINES, 'en')
    expect(offline!.goal).toEqual({ lng: 7.83, lat: 46.74 })
    expect(offline!.seed.startPoint).toEqual({ lng: 7.88, lat: 46.78 })
  })

  it('should plan nothing from a route without points', async () => {
    expect(await planFromRoute(ROUTE, [[]], 'en')).toBeNull()
  })
})

describe('routeLine (#352)', () => {
  it('should run the route from the start up to the summit across its parts, leaving out a variant', () => {
    // Main line in two parts meeting at the col; a variant branches off the col to a second top.
    const parts: LngLat[][] = [[[7.83, 46.74], [7.85, 46.76]], [[7.85, 46.76], [7.88, 46.78]], [[7.85, 46.76], [7.86, 46.79]]]
    const line = routeLine(parts, [7.83, 46.74], [7.8801, 46.7801])
    expect(line[0]![0]).toBeCloseTo(7.83, 6)
    expect(line.at(-1)![0]).toBeCloseTo(7.88, 6)
    expect(line.some(([lng]) => Math.abs(lng - 7.86) < 1e-6)).toBe(false)
  })

  it('should fall back to the longest part, run from the start, when the parts do not meet', () => {
    const parts: LngLat[][] = [[[7.88, 46.78], [7.86, 46.77], [7.83, 46.74]], [[8.5, 46.5], [8.51, 46.5]]]
    expect(routeLine(parts, [7.83, 46.74], [9.5, 47.5])).toEqual([[7.83, 46.74], [7.86, 46.77], [7.88, 46.78]])
  })
})

describe('planFromRoute track (#352)', () => {
  beforeEach(() => {
    mockSearch.mockReset().mockResolvedValue([])
  })

  it('should go up and back down the route when SAC states a descent, so its numbers are the route\'s', async () => {
    const plan = await planFromRoute(ROUTE, LINES, 'en')
    const line = plan!.track.legs.flatMap((leg, i) => (i === 0 ? leg : leg.slice(1)))
    expect(line[0]).toEqual(line.at(-1))
    // Turns at the summit end of the route.
    expect(line.some(([lng, lat]) => Math.abs(lng - 7.88) < 1e-9 && Math.abs(lat - 46.78) < 1e-9)).toBe(true)
  })

  it('should only go up a route without a descent', async () => {
    const plan = await planFromRoute({ ...ROUTE, descentM: 0 }, LINES, 'en')
    const line = plan!.track.legs.flat()
    expect(line.at(-1)).not.toEqual(line[0])
  })
})
