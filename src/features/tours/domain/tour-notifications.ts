import type { Tour, TourDraft } from '@/features/tours/domain/entities/tour'

/** True when the two partner id sets differ (order-independent). */
function partnerSetChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length)
    return true
  const setB = new Set(b)
  return a.some(id => !setB.has(id))
}

function dateChanged(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) !== (b?.getTime() ?? null)
}

/**
 * True when either endpoint of the planned span moved — a tour grown from one day to three
 * is exactly the kind of change a partner must hear about.
 */
function plannedSpanChanged(prev: Tour, draft: TourDraft): boolean {
  return (
    dateChanged(prev.plannedDate, draft.plannedDate) || dateChanged(prev.endDate, draft.endDate)
  )
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
 * name, planned date span (either endpoint), goal location, tour type, partners, GPX track, description,
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
    || plannedSpanChanged(prev, draft)
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
 * The suggestion fields (design D2) whose accept warrants the existing `tour_updates`
 * notification to the OTHER partners (D16) — the same partner-facing set as
 * `isMeaningfulTourChange` above, expressed per logical field. If the meeting point moves
 * because a partner suggested it, every other partner has the same need to know as when
 * the owner moves it themselves.
 */
const MEANINGFUL_SUGGESTION_FIELDS = new Set([
  'name',
  'dates',
  'goal',
  'tour_type',
  'gpx',
  'description',
  'equipment',
])

export function isMeaningfulSuggestionField(field: string): boolean {
  return MEANINGFUL_SUGGESTION_FIELDS.has(field)
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
