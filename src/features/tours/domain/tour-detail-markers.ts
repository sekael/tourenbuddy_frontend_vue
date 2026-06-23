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
  /**
   * Re-picked, not-yet-saved coordinate. Set ONLY when it genuinely differs from
   * `saved` (the caller diffs first), so its presence always means "being edited".
   */
  draft: LngLat | null
}

export interface TourDetailMarkersInput {
  /** Type driving marker color; null → neutral fallback (handled by the layer). */
  tourType: TourType | null
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
      out.push({ pointKind: 'start', lngLat: start, tourType: input.tourType, draft })
    if (end !== null && anchor !== null && !isSameGoal(end, anchor))
      out.push({ pointKind: 'end', lngLat: end, tourType: input.tourType, draft })
    return out
  }

  return [
    ...tone(input.start.saved, input.end.saved, input.start.saved, false),
    ...tone(input.start.draft, input.end.draft, effectiveStart, true),
  ]
}
