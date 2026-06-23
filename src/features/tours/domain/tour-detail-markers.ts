import type { TourType } from '@/features/tours/data/models/tour-type'
import { isSameGoal } from '@/features/tours/domain/distance'

/** Which point a detail marker represents. The goal is rendered separately. */
export type DetailPointKind = 'start' | 'end'

interface LngLat {
  lng: number
  lat: number
}

/**
 * One resolved start/end marker to render. `draft` selects the lighter preview
 * tone (a not-yet-saved, re-picked location) over the saved full color.
 */
export interface DetailMarker {
  pointKind: DetailPointKind
  lngLat: LngLat
  tourType: TourType | null
  draft: boolean
}

/** Per-point inputs: the saved tour coordinate and an optional draft override. */
interface PointInput {
  /** Coordinate stored on the tour (null while creating, or if unset). */
  saved: LngLat | null
  /** Re-picked, not-yet-saved coordinate; takes precedence and renders as draft. */
  draft: LngLat | null
}

export interface TourDetailMarkersInput {
  /** Type driving marker color; null → neutral fallback (handled by the layer). */
  tourType: TourType | null
  start: PointInput
  end: PointInput
}

/**
 * Resolves a point to the coordinate that should render and whether it is a draft.
 * A draft (re-picked, not-yet-saved) coordinate takes precedence over the saved one.
 * Returns `null` when the point has neither — a normal "no point here" case (a
 * one-way tour with no end, or a not-yet-picked point during creation), so callers
 * branch on the value instead of guarding against an error. Total by design.
 */
function resolvePoint(point: PointInput): { coord: LngLat, draft: boolean } | null {
  if (point.draft !== null) {
    return { coord: point.draft, draft: true }
  }
  if (point.saved !== null) {
    return { coord: point.saved, draft: false }
  }
  return null
}

/**
 * Resolves which start/end markers to render for the open/created tour.
 *
 * Policy (mirrors the info sheet):
 * - The start marker shows whenever a start coordinate exists (draft over saved).
 * - The end marker shows ONLY when an end coordinate exists AND is distinct from
 *   the effective start (use `isSameGoal`). Round-trip (end == start) and
 *   one-way-to-goal (no end) tours therefore yield a start marker and no end marker.
 * - A point renders as `draft: true` when its coordinate came from the draft
 *   override, else `draft: false` (saved, full color). Unchanged points stay saved.
 */
export function tourDetailMarkers(input: TourDetailMarkersInput): DetailMarker[] {
  const detailMarkers: DetailMarker[] = []

  const effectiveStart = resolvePoint(input.start)
  if (effectiveStart === null) {
    return detailMarkers
  }
  detailMarkers.push({ pointKind: 'start', lngLat: effectiveStart.coord, tourType: input.tourType, draft: effectiveStart.draft })

  const effectiveEnd = resolvePoint(input.end)

  if (effectiveEnd !== null && !isSameGoal(effectiveStart.coord, effectiveEnd.coord)) {
    detailMarkers.push({ pointKind: 'end', lngLat: effectiveEnd.coord, tourType: input.tourType, draft: effectiveEnd.draft })
  }
  return detailMarkers
}
