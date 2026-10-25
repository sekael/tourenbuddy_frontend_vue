import type { LngLat, SkiRouteInfo } from '@/features/map/domain/entities/trail'
import type { TourDraft } from '@/features/tours/domain/entities/tour'
import { haversineMeters } from '@/core/utils/haversine'
import { searchLocations } from '@/features/map/data/services/swisstopo-search-service'

interface Point { lng: number, lat: number }

/** The summit named like the route's target must lie this close to the route. */
const SUMMIT_NEAR_M = 1500

/** The place named like `targetName` nearest the route (`toRoute` metres), if close enough. */
async function findSummit(targetName: string, lang: string, toRoute: (p: Point) => number): Promise<Point | undefined> {
  // "Furggegütsch (Hohgant)": the place search knows the summit without its massif.
  const query = targetName.replace(/\s*\([^)]*\)\s*$/, '').trim()
  try {
    const found = await searchLocations(query, lang, new AbortController().signal)
    return found
      .filter(r => r.name.trim().toLowerCase() === query.toLowerCase())
      .map(r => ({ point: { lng: r.lng, lat: r.lat }, distance: toRoute(r) }))
      .filter(r => r.distance <= SUMMIT_NEAR_M)
      .sort((a, b) => a.distance - b.distance)[0]
      ?.point
  }
  catch {
    return undefined
  }
}

/**
 * A ski route as a tour to plan (design D7 of smarter-tour-creation): the goal on the route's
 * target summit, the start at the route end farthest from it, activity ski tour, the route's grade,
 * and its name and SAC link as description.
 *
 * The summit comes from the place search (the target by name, nearest the route): a route's ends
 * don't reliably hold it — a multi-part route can end on a variant. Without the search (offline,
 * no match) the route's last point is the goal, which holds for most routes (foot → summit).
 */
export async function planFromRoute(
  route: SkiRouteInfo,
  lines: LngLat[][],
  lang: string,
): Promise<{ goal: Point, seed: TourDraft } | null> {
  const ends = lines.filter(line => line.length > 0).flatMap(line => [line[0]!, line.at(-1)!])
  if (ends.length === 0)
    return null
  const vertices = lines.flat()
  const toRoute = (p: Point) => Math.min(...vertices.map(v => haversineMeters([p.lng, p.lat], v)))

  const summit = await findSummit(route.targetName, lang, toRoute)
  const [lng, lat] = ends.at(-1)!
  const goal = summit ?? { lng, lat }
  const fromGoal = (p: LngLat) => haversineMeters([goal.lng, goal.lat], p)
  const [startLng, startLat] = ends.reduce((far, p) => (fromGoal(p) > fromGoal(far) ? p : far))

  return {
    goal,
    seed: {
      name: route.targetName,
      plannedDate: null,
      endDate: null,
      partnerIds: [],
      tourTypes: ['skitour'],
      elevation: route.targetAltitude,
      gpxFilepath: null,
      description: [route.name, route.sacUrl].filter(Boolean).join('\n') || null,
      seasons: null,
      startPoint: { lng: startLng, lat: startLat },
      endPoint: null,
      // Named and measured by the form's own lookup (the host sends it as a start pick).
      startPointName: null,
      startPointElevation: null,
      endPointName: null,
      endPointElevation: null,
      equipment: null,
      notes: null,
      grade: route.difficulty,
      startTime: null,
    },
  }
}
