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
  tourTypes: TourType[]
  draft: boolean
}

/** Per-point inputs: the saved tour coordinate and an optional draft override. */
interface PointInput {
  /** Coordinate stored on the tour (null while creating, or if unset). */
  saved: LngLat | null
  /**
   * Re-picked, not-yet-saved coordinate. Set ONLY when it genuinely differs from
   * `saved` (the caller diffs first), so its presence always means "being edited".
   */
  draft: LngLat | null
}

export interface TourDetailMarkersInput {
  /** Types driving marker color; empty → neutral fallback (handled by the layer). */
  tourTypes: TourType[]
  start: PointInput
  end: PointInput
}

/**
 * Resolves which start/end markers to render for the open/created tour.
 *
 * Mirrors the goal marker's edit behavior: the SAVED marker always stays
 * visible, and while a point is being edited its DRAFT marker shows ALONGSIDE
 * it (lighter tone, new position) — not in place of it. Cancel drops the draft
 * (its `previewStart`/`previewEnd` clears); save promotes it (the tour's saved
 * coordinate updates and the draft clears). So a point with both a saved and a
 * draft coordinate yields TWO markers.
 *
 * Round-trip dedup, per tone: an end marker is omitted when it coincides
 * (`isSameGoal`) with the start of the same tone — a saved round trip shows one
 * saved marker; a draft round trip shows one draft marker. A tour with no
 * effective start (no saved and no draft start) renders nothing — an end never
 * appears orphaned.
 */
export function tourDetailMarkers(input: TourDetailMarkersInput): DetailMarker[] {
  const effectiveStart = input.start.draft ?? input.start.saved
  if (effectiveStart === null)
    return []

  // One tone (saved or draft): the start always shows; the end shows only when
  // it's distinct from that tone's anchoring start (round-trip dedup).
  function tone(
    start: LngLat | null,
    end: LngLat | null,
    anchor: LngLat | null,
    draft: boolean,
  ): DetailMarker[] {
    const out: DetailMarker[] = []
    if (start !== null)
      out.push({ pointKind: 'start', lngLat: start, tourTypes: input.tourTypes, draft })
    if (end !== null && anchor !== null && !isSameGoal(end, anchor))
      out.push({ pointKind: 'end', lngLat: end, tourTypes: input.tourTypes, draft })
    return out
  }

  return [
    ...tone(input.start.saved, input.end.saved, input.start.saved, false),
    ...tone(input.start.draft, input.end.draft, effectiveStart, true),
  ]
}

interface SegmentPoints {
  tourTypes: TourType[]
  goal: LngLat
  startPoint: LngLat | null
  endPoint: LngLat | null
}

/**
 * The whole outing's start/end markers (#338): where its first segment starts and its last one
 * ends, each in its segment's colours. The end is dropped when it coincides with that start (a
 * round outing) or with the last goal (the goal marker already stands there).
 */
export function outingDetailMarkers(segments: readonly SegmentPoints[]): DetailMarker[] {
  const first = segments[0]
  const last = segments.at(-1)
  if (!first?.startPoint || !last)
    return []
  const out: DetailMarker[] = [{ pointKind: 'start', lngLat: first.startPoint, tourTypes: first.tourTypes, draft: false }]
  const end = last.endPoint
  if (end && !isSameGoal(end, first.startPoint) && !isSameGoal(end, last.goal))
    out.push({ pointKind: 'end', lngLat: end, tourTypes: last.tourTypes, draft: false })
  return out
}
