import type { LngLat, SkiRouteInfo } from '@/features/map/domain/entities/trail'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planFromRoute } from '@/features/map/presentation/composables/plan-from-route'

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
