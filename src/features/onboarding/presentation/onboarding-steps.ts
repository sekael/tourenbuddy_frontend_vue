import type { Popover } from 'driver.js'

/**
 * Declarative descriptors for the onboarding spotlight tour.
 *
 * Each step names the *surface* that must be staged (opened) before its target
 * can be highlighted, plus the `data-tour` selector of the element to spotlight
 * and the i18n keys for its copy. `map-page.vue` maps each surface to the
 * concrete open/close calls (it owns `activeOverlay` and the speed-dial refs);
 * the tour composable only knows surfaces, not how to open them.
 *
 * Targets are stable containers that exist even for a brand-new user (empty
 * lists), so steps don't silently skip on a fresh account.
 */

/**
 * The on-screen surface a step's target lives in. Map-tour and calendar-tour
 * each handle only their own subset in their `stage` function; the union is
 * shared because both reuse the same `OnboardingStep` shape + tour composable.
 */
export type TourSurface
  = | 'profile' // user profile sheet
    | 'contacts' // contacts list sheet
    | 'friend-requests' // friend-requests sheet
    | 'tours' // My Tours list sheet (own / friends tabs)
    | 'tour-bar' // always-visible bottom tour action bar
    | 'base-map-panel' // speed-dial base-map switcher panel
    | 'menu' // speed-dial menu, open with nothing expanded
    | 'today-nav' // calendar: the planned/calendar nav tab (tap-again jumps to today)
    | 'availability' // calendar: availability edit FAB (planned view)
    | 'day-chips' // calendar: the today cell's demo tour/friend chips (planned view)
    | 'seasons' // calendar: the seasonal overview (seasons view)

export interface OnboardingStep {
  /** Surface to stage before highlighting. */
  surface: TourSurface
  /** CSS selector for the spotlight target (a stable `data-tour` anchor). */
  target: string
  /** i18n key for the popover title. */
  titleKey: string
  /** i18n key for the popover body. */
  bodyKey: string
  /** i18n key for the short banner label (distinct from the popover title). */
  labelKey: string
  /**
   * Optional popover placement override (defaults to `bottom` / `center`).
   * The top banner is pinned above every target, so `bottom` is the safe
   * default. Steps whose target sits low in a tall surface (e.g. the
   * notification toggles deep in the profile dialog) override to `top` so the
   * popover never spills past the screen bottom — where driver.js would
   * otherwise flip it up and collide it with the banner.
   */
  side?: Popover['side']
  align?: Popover['align']
  /**
   * How the target is scrolled into view before highlighting (defaults to
   * `start` / `nearest`). A target inside a scroll container whose top is pinned
   * under the fixed tour banner (e.g. the calendar's today row / seasons bar on
   * mobile) overrides to `center` so the spotlight cutout clears the banner.
   */
  scrollBlock?: ScrollLogicalPosition
  scrollInline?: ScrollLogicalPosition
}

/**
 * The onboarding steps, in presentation order. Grouped by surface — map,
 * you (profile), people (contacts), tours — so consecutive steps on the same
 * surface only glide the spotlight instead of re-driving the navigation.
 * Ends on the calendar entry: completing the tour hands off to /calendar.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    // Open with the core action. Nothing to navigate, so the tour starts calm.
    surface: 'tour-bar',
    target: '[data-tour="add-tour"]',
    titleKey: 'onboarding.tour.addLocation.title',
    bodyKey: 'onboarding.tour.addLocation.body',
    labelKey: 'onboarding.tour.labels.addLocation',
    // The action bar is pinned to the viewport bottom: there's no room for the
    // default `bottom` placement, so driver.js would flip the popover up.
    side: 'top',
  },
  {
    surface: 'base-map-panel',
    target: '[data-tour="basemap"]',
    titleKey: 'onboarding.tour.basemap.title',
    bodyKey: 'onboarding.tour.basemap.body',
    labelKey: 'onboarding.tour.labels.basemap',
  },
  {
    // The menu entry itself (not the manage sheet behind it): one tap away, and
    // the speed-dial stays open from the base-map step — only the panel folds.
    surface: 'menu',
    target: '[data-tour="menu-offline-map"]',
    titleKey: 'onboarding.tour.offlineMap.title',
    bodyKey: 'onboarding.tour.offlineMap.body',
    labelKey: 'onboarding.tour.labels.offlineMap',
  },
  {
    surface: 'profile',
    target: '[data-tour="phone-verification"]',
    titleKey: 'onboarding.tour.phone.title',
    bodyKey: 'onboarding.tour.phone.body',
    labelKey: 'onboarding.tour.labels.phone',
  },
  {
    surface: 'profile',
    target: '[data-tour="notifications"]',
    titleKey: 'onboarding.tour.notifications.title',
    bodyKey: 'onboarding.tour.notifications.body',
    labelKey: 'onboarding.tour.labels.notifications',
    // The Notifications row sits in the lower half of the profile sheet; place
    // the popover above it so it can't overflow the screen bottom (and get
    // flipped into the banner). It lands over the sheet's upper area, clear of
    // the pinned banner.
    side: 'top',
  },
  {
    surface: 'profile',
    target: '[data-tour="calendar-sync"]',
    titleKey: 'onboarding.tour.calendarSync.title',
    bodyKey: 'onboarding.tour.calendarSync.body',
    labelKey: 'onboarding.tour.labels.calendarSync',
    // Right below Notifications — same reasoning, popover above.
    side: 'top',
  },
  {
    surface: 'contacts',
    target: '[data-tour="add-contact"]',
    titleKey: 'onboarding.tour.addContact.title',
    bodyKey: 'onboarding.tour.addContact.body',
    labelKey: 'onboarding.tour.labels.addContact',
  },
  {
    surface: 'friend-requests',
    target: '[data-tour="friend-requests"]',
    titleKey: 'onboarding.tour.friendRequests.title',
    bodyKey: 'onboarding.tour.friendRequests.body',
    labelKey: 'onboarding.tour.labels.friendRequests',
  },
  {
    surface: 'tours',
    target: '[data-tour="tours"]',
    titleKey: 'onboarding.tour.tours.title',
    bodyKey: 'onboarding.tour.tours.body',
    labelKey: 'onboarding.tour.labels.tours',
  },
  {
    // Final step: point at the calendar-open button in the My Tours sheet header
    // (teaching where the calendar lives). Same surface as the previous step, so
    // the spotlight just glides up. No navigation here — the hand-off to
    // /calendar happens on tour completion.
    surface: 'tours',
    target: '[data-tour="open-calendar"]',
    titleKey: 'onboarding.tour.openCalendar.title',
    bodyKey: 'onboarding.tour.openCalendar.body',
    labelKey: 'onboarding.tour.labels.openCalendar',
  },
]
