import type { TourOuting } from '@/features/tours/data/models/tour-schema'
import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'

/**
 * Outings made of segments (#338). An outing is the owner's tours sharing an `outing.id`;
 * membership, name and order live on each tour (design D11).
 */

/**
 * Owner + outing id (D14): a friend can read an outing id and copy it onto their own tour,
 * so the id alone must never pull another user's tour into the outing.
 */
export function outingKey(tour: Pick<Tour, 'userId' | 'outing'>): string | null {
  return tour.outing ? `${tour.userId}/${tour.outing.id}` : null
}

/** Position, then id — a stable order even when two offline edits picked the same position (D13). */
function bySegmentOrder(a: Tour, b: Tour): number {
  return a.outing!.position - b.outing!.position || a.id.localeCompare(b.id)
}

/**
 * The segments of the outing `key` among `tours`, in order. Fewer than two visible segments is
 * no outing (D14) — a lone segment presents as a plain tour — so that case returns [].
 */
export function outingSegments(tours: Tour[], key: string | null): Tour[] {
  if (!key)
    return []
  const segments = tours.filter(t => outingKey(t) === key).sort(bySegmentOrder)
  return segments.length >= 2 ? segments : []
}

/** The outing's own name, else its first segment's name. */
export function outingDisplayName(segments: Tour[]): string | null {
  return segments[0]?.outing?.name ?? segments[0]?.name ?? null
}

/** First day … last day across the segments (null when none is dated). */
export function outingSpan(segments: Tour[]): { start: Date, end: Date } | null {
  const days = segments.flatMap(s => [s.plannedDate, s.endDate].filter((d): d is Date => d != null))
  if (days.length === 0)
    return null
  const times = days.map(d => d.getTime())
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) }
}

/** Membership for a tour appended after every segment in `segments` (D13). */
export function appendedOuting(outing: TourOuting, segments: Pick<Tour, 'outing'>[]): TourOuting {
  const last = Math.max(-1, ...segments.map(s => s.outing?.position ?? -1))
  return { id: outing.id, name: outing.name, position: last + 1 }
}

/**
 * The creation form's seed for the segment after `prev` (D17): same activities, partners,
 * visibility and seasons, on its last day, starting where it ended (its end point, else its goal).
 */
export function nextSegmentSeed(prev: Tour): TourDraft {
  const fromEnd = prev.endPoint != null
  const startElevation = fromEnd ? prev.endPointElevation : prev.elevation
  return {
    name: null,
    plannedDate: prev.endDate ?? prev.plannedDate,
    endDate: null,
    partnerIds: prev.partnerIds,
    tourTypes: prev.tourTypes,
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: prev.seasons,
    startPoint: fromEnd ? prev.endPoint : prev.goal,
    endPoint: null,
    startPointName: fromEnd ? prev.endPointName : prev.name,
    // The goal's elevation may carry decimals; a point elevation is whole metres.
    startPointElevation: startElevation == null ? null : Math.round(startElevation),
    endPointName: null,
    endPointElevation: null,
    equipment: null,
    notes: null,
    visibility: prev.visibility,
  }
}
