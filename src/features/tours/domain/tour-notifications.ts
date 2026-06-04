import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'

/** True when the two partner id sets differ (order-independent). */
function partnerSetChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length)
    return true
  const setB = new Set(b)
  return a.some(id => !setB.has(id))
}

function plannedDateChanged(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) !== (b?.getTime() ?? null)
}

export interface TourEditComparison {
  /** New goal coordinates (the form controls this separately from the draft). */
  goal: { lng: number, lat: number }
  /** Resolved new gpx filepath after the edit (null if removed). */
  gpxFilepath: string | null
}

/**
 * Whether an edit touched a partner-facing field and therefore warrants notifying
 * friend partners. Partner-facing set (mission-critical for a mountain tour):
 * name, planned date, goal location, tour type, partners, GPX track, description,
 * equipment. Cosmetic/owner-private fields (notes, elevation, seasons, start/end
 * detail) are intentionally excluded. Completion flips are handled at their own
 * call site, and visibility changes never notify.
 */
export function isMeaningfulTourChange(
  prev: Tour,
  draft: TourDraft,
  next: TourEditComparison,
): boolean {
  return (
    prev.name !== draft.name
    || plannedDateChanged(prev.plannedDate, draft.plannedDate)
    || prev.goal.lng !== next.goal.lng
    || prev.goal.lat !== next.goal.lat
    || prev.tourType !== draft.tourType
    || partnerSetChanged(prev.partnerIds, draft.partnerIds)
    || prev.gpxFilepath !== next.gpxFilepath
    || prev.description !== draft.description
    || prev.equipment !== draft.equipment
  )
}

/**
 * Whether a tour is worth dispatching a shared-tour notification for at all:
 * it must be friends-visible and have at least one partner. Private tours share
 * nothing; partnerless tours have no one to notify. The Worker still filters
 * partners down to actual friends.
 */
export function isShareableTour(
  visibility: TourDraft['visibility'] | Tour['visibility'],
  partnerIds: string[],
): boolean {
  return (visibility ?? 'friends') !== 'private' && partnerIds.length > 0
}
