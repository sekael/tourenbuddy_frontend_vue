import type { Tour } from '@/features/tours/domain/entities/tour'
import { haversineMeters } from '@/core/utils/haversine'
import { isSameGoal } from '@/features/tours/domain/distance'

/**
 * A route's numbers (design D19): what a guide plans by, derived from data the tour already
 * holds — never typed, never guessed. `null` = not known.
 */
export interface RouteMetrics {
  /** Metres climbed. */
  ascent: number | null
  /** Metres descended. */
  descent: number | null
  /** Horizontal metres; only a track knows it. */
  distance: number | null
}

const UNKNOWN: RouteMetrics = { ascent: null, descent: null, distance: null }

/**
 * A height swing counts only once it reaches this far from the last turning point, so recorder
 * noise on a flat stretch does not add up to phantom metres.
 * ponytail: one threshold for every recorder; barometric tracks could take less.
 */
const HYSTERESIS_M = 5

type HeightPoints = Pick<Tour, 'elevation' | 'startPoint' | 'startPointElevation' | 'endPoint' | 'endPointElevation'>

/**
 * Climb and descent over start → goal → end heights: the goal itself when the tour ends there,
 * the start's height on a round trip that has none of its own. Counter-climbs between the points
 * are unknown, so these are the route's net numbers — as SAC states them per stage.
 */
export function pointMetrics(tour: HeightPoints): RouteMetrics {
  const start = tour.startPoint ? tour.startPointElevation : null
  const goal = tour.elevation
  const end = !tour.endPoint
    ? goal
    : tour.endPointElevation ?? (tour.startPoint && isSameGoal(tour.endPoint, tour.startPoint) ? start : null)
  if (start == null || goal == null || end == null)
    return UNKNOWN
  const legs = [goal - start, end - goal]
  return {
    ascent: Math.round(legs.reduce((sum, d) => sum + Math.max(d, 0), 0)),
    descent: Math.round(legs.reduce((sum, d) => sum + Math.max(-d, 0), 0)),
    distance: null,
  }
}

function trackLines(track: GeoJSON.FeatureCollection): GeoJSON.Position[][] {
  return track.features.flatMap(({ geometry: g }) => {
    if (g?.type === 'LineString')
      return [g.coordinates]
    return g?.type === 'MultiLineString' ? g.coordinates : []
  })
}

/** Horizontal distance, climb and descent along a GPX track; heights stay unknown if any point lacks one. */
export function trackMetrics(track: GeoJSON.FeatureCollection): RouteMetrics {
  const lines = trackLines(track).filter(line => line.length > 0)
  if (lines.length === 0)
    return UNKNOWN
  let distance = 0
  let ascent = 0
  let descent = 0
  let heights = true
  for (const line of lines) {
    let level: number | undefined
    line.forEach((p, i) => {
      if (i > 0)
        distance += haversineMeters(line[i - 1] as [number, number], p as [number, number])
      const h = p[2]
      if (h === undefined) {
        heights = false
        return
      }
      if (level === undefined) {
        level = h
      }
      else if (Math.abs(h - level) >= HYSTERESIS_M) {
        if (h > level)
          ascent += h - level
        else
          descent += level - h
        level = h
      }
    })
  }
  return {
    ascent: heights ? Math.round(ascent) : null,
    descent: heights ? Math.round(descent) : null,
    distance: Math.round(distance),
  }
}

/** The track's numbers when it has heights; else the point heights' climb and descent, with the track's distance. */
export function routeMetrics(tour: HeightPoints, track?: GeoJSON.FeatureCollection | null): RouteMetrics {
  const points = pointMetrics(tour)
  if (!track)
    return points
  const fromTrack = trackMetrics(track)
  return fromTrack.ascent === null ? { ...points, distance: fromTrack.distance } : fromTrack
}

/** Sum per number; unknown as soon as one route lacks it — a partial total misleads. */
export function totalMetrics(routes: readonly RouteMetrics[]): RouteMetrics {
  const total = (key: keyof RouteMetrics) =>
    routes.length > 0 && routes.every(r => r[key] !== null) ? routes.reduce((sum, r) => sum + r[key]!, 0) : null
  return { ascent: total('ascent'), descent: total('descent'), distance: total('distance') }
}
