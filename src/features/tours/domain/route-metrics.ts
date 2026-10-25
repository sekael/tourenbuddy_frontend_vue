import type { Tour } from '@/features/tours/domain/entities/tour'
import { haversineMeters } from '@/core/utils/haversine'
import { isSameGoal } from '@/features/tours/domain/distance'
import { fliesDown } from '@/features/tours/domain/legs'

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
  & Partial<Pick<Tour, 'goal' | 'legs' | 'tourTypes'>>

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

interface LngLat { lng: number, lat: number }

/** A track's first and last point (lines in file order); null for a track without points. */
export function trackEnds(track: GeoJSON.FeatureCollection): { first: LngLat, last: LngLat } | null {
  const points = trackLines(track).flat()
  const [first, last] = [points[0], points.at(-1)]
  return first && last ? { first: { lng: first[0]!, lat: first[1]! }, last: { lng: last[0]!, lat: last[1]! } } : null
}

/** Index of the line's vertex nearest `point`. */
function nearestVertex(line: readonly GeoJSON.Position[], point: LngLat): number {
  let best = Number.POSITIVE_INFINITY
  let index = 0
  line.forEach((p, i) => {
    const d = haversineMeters(p as [number, number], [point.lng, point.lat])
    if (d < best) {
      best = d
      index = i
    }
  })
  return index
}

function lineLength(line: readonly GeoJSON.Position[]) {
  return line.reduce((sum, p, i) => (i > 0 ? sum + haversineMeters(line[i - 1] as [number, number], p as [number, number]) : sum), 0)
}

/** Share of the line's length (0–1) at its vertex nearest `point`; 0 for a line without length. */
export function progressNearest(line: readonly GeoJSON.Position[], point: LngLat): number {
  const total = lineLength(line)
  return total > 0 ? lineLength(line.slice(0, nearestVertex(line, point) + 1)) / total : 0
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

function asTrack(coordinates: GeoJSON.Position[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }] }
}

/**
 * A split tour's single-line track per leg (activity-legs), cut at the vertex nearest the goal:
 * the climb of the way up, the descent of the way down — a flown one as its net drop, so a
 * thermal is neither a climb nor extra descent, and its distance as the way up's alone: the
 * flight's line says nothing about the day's legwork. Null when the track can't be cut.
 * ponytail: a multi-line track keeps the whole-track numbers.
 */
function legTrackMetrics(tour: HeightPoints, track: GeoJSON.FeatureCollection, whole: RouteMetrics): RouteMetrics | null {
  const geometry = track.features.length === 1 ? track.features[0]!.geometry : null
  if (!tour.legs || !tour.goal || geometry?.type !== 'LineString' || whole.ascent === null)
    return null
  const line = geometry.coordinates
  const cut = nearestVertex(line, tour.goal)
  const up = line.slice(0, cut + 1)
  const down = line.slice(cut)
  const flown = fliesDown({ tourTypes: tour.tourTypes ?? [], legs: tour.legs })
  return {
    ascent: trackMetrics(asTrack(up)).ascent,
    descent: flown
      ? Math.round(Math.max(0, (down[0]![2] ?? 0) - (down.at(-1)![2] ?? 0)))
      : trackMetrics(asTrack(down)).descent,
    distance: flown ? Math.round(lineLength(up)) : whole.distance,
  }
}

/** The track's numbers when it has heights; else the point heights' climb and descent, with the track's distance. */
export function routeMetrics(tour: HeightPoints, track?: GeoJSON.FeatureCollection | null): RouteMetrics {
  const points = pointMetrics(tour)
  if (!track)
    return points
  const fromTrack = trackMetrics(track)
  if (fromTrack.ascent === null)
    return { ...points, distance: fromTrack.distance }
  return legTrackMetrics(tour, track, fromTrack) ?? fromTrack
}

/** Sum per number; unknown as soon as one route lacks it — a partial total misleads. */
export function totalMetrics(routes: readonly RouteMetrics[]): RouteMetrics {
  const total = (key: keyof RouteMetrics) =>
    routes.length > 0 && routes.every(r => r[key] !== null) ? routes.reduce((sum, r) => sum + r[key]!, 0) : null
  return { ascent: total('ascent'), descent: total('descent'), distance: total('distance') }
}
