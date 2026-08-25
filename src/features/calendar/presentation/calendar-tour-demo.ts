import type { DayEntry } from '@/features/calendar/domain/calendar-dates'
import type { Season } from '@/features/tours/data/models/season'
import type { Tour } from '@/features/tours/domain/entities/tour'

/**
 * Hardcoded demo content for the calendar tour — the "meaning of the day-chips"
 * and "seasonal overview" steps have nothing to point at for a brand-new user
 * (no tours, no friends). This is the SINGLE source of the demo artifacts:
 *
 *   1. Source isolation — never written to `toursStore` / `availabilityStore`,
 *      so no store or DB path can surface it.
 *   2. It is rendered only through the tour-active–gated branches in
 *      `planned-calendar.vue` / `seasons-gantt.vue`.
 *
 * `t` is threaded in so the demo names are localized like any other UI copy.
 */
type Translate = (key: string) => string

/** One demo tour chip + one demo friend chip for the today cell (planned view). */
export function makeDemoChips(t: Translate): {
  entries: DayEntry[]
  friends: { userId: string, name: string }[]
} {
  const tour: Tour = {
    id: 'demo-tour',
    userId: 'demo',
    plannedDate: new Date(),
    endDate: null,
    goal: { lng: 8.0, lat: 46.8 },
    name: t('calendar.tour.demo.tourName'),
    partnerIds: [],
    tourType: 'skitour',
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    startPointName: null,
    startPointElevation: null,
    endPointName: null,
    endPointElevation: null,
    equipment: null,
    notes: null,
    completed: false,
    visibility: 'friends',
    isFriendTour: false,
  }
  return {
    entries: [{ tour, isFriend: false, dayIndex: 1, dayCount: 1 }],
    friends: [{ userId: 'demo-friend', name: t('calendar.tour.demo.friendName') }],
  }
}

/** One demo season bar for the seasonal-overview step (seasons view). */
export function makeDemoSeason(t: Translate): { name: string, seasons: Season[] } {
  return { name: t('calendar.tour.demo.seasonTourName'), seasons: ['winter', 'spring'] }
}
