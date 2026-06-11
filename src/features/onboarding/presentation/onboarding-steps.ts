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

/** The on-screen surface a step's target lives in. */
export type TourSurface
  = | 'profile' // user profile sheet
    | 'contacts' // contacts list sheet
    | 'friend-requests' // friend-requests sheet
    | 'tours' // My Tours list sheet (own / friends tabs)
    | 'tour-bar' // always-visible bottom tour action bar
    | 'base-map-panel' // speed-dial base-map switcher panel

export interface OnboardingStep {
  /** Surface to stage before highlighting. */
  surface: TourSurface
  /** CSS selector for the spotlight target (a stable `data-tour` anchor). */
  target: string
  /** i18n key for the popover title. */
  titleKey: string
  /** i18n key for the popover body. */
  bodyKey: string
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
}

/** The onboarding steps, in presentation order. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    surface: 'profile',
    target: '[data-tour="phone-verification"]',
    titleKey: 'onboarding.tour.phone.title',
    bodyKey: 'onboarding.tour.phone.body',
  },
  {
    surface: 'profile',
    target: '[data-tour="notifications"]',
    titleKey: 'onboarding.tour.notifications.title',
    bodyKey: 'onboarding.tour.notifications.body',
    // Notifications sit low in the profile dialog; place the popover above the
    // target so it can't overflow the screen bottom (and get flipped into the
    // banner). It lands in the dialog's upper area, clear of the pinned banner.
    side: 'top',
  },
  {
    surface: 'contacts',
    target: '[data-tour="add-contact"]',
    titleKey: 'onboarding.tour.addContact.title',
    bodyKey: 'onboarding.tour.addContact.body',
  },
  {
    surface: 'contacts',
    target: '[data-tour="contacts"]',
    titleKey: 'onboarding.tour.contacts.title',
    bodyKey: 'onboarding.tour.contacts.body',
  },
  {
    surface: 'friend-requests',
    target: '[data-tour="friend-requests"]',
    titleKey: 'onboarding.tour.friendRequests.title',
    bodyKey: 'onboarding.tour.friendRequests.body',
  },
  {
    surface: 'tours',
    target: '[data-tour="tours"]',
    titleKey: 'onboarding.tour.tours.title',
    bodyKey: 'onboarding.tour.tours.body',
  },
  {
    surface: 'tour-bar',
    target: '[data-tour="add-tour"]',
    titleKey: 'onboarding.tour.addLocation.title',
    bodyKey: 'onboarding.tour.addLocation.body',
  },
  {
    surface: 'base-map-panel',
    target: '[data-tour="basemap"]',
    titleKey: 'onboarding.tour.basemap.title',
    bodyKey: 'onboarding.tour.basemap.body',
  },
]
