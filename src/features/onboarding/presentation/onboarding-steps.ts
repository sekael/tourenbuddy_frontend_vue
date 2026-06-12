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
}

/** The onboarding steps, in presentation order. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
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
    labelKey: 'onboarding.tour.labels.addContact',
  },
  {
    surface: 'contacts',
    // Spotlight a single entry, not the whole `.contacts-content` scroll
    // container — that flex:1 box fills the sheet, so highlighting it made a
    // giant cutout and left driver.js no room below for the popover (it flipped
    // up behind the pinned banner). The first contact row (or the empty-state
    // for a brand-new user) is compact, so the popover drops cleanly beneath it.
    target: '[data-tour="contacts"] .empty-state, [data-tour="contacts"] .contact-row',
    titleKey: 'onboarding.tour.contacts.title',
    bodyKey: 'onboarding.tour.contacts.body',
    labelKey: 'onboarding.tour.labels.contacts',
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
    surface: 'tour-bar',
    target: '[data-tour="add-tour"]',
    titleKey: 'onboarding.tour.addLocation.title',
    bodyKey: 'onboarding.tour.addLocation.body',
    labelKey: 'onboarding.tour.labels.addLocation',
    // The action bar is pinned to the viewport bottom: there's no room for the
    // default `bottom` placement, so driver.js flips the popover up and the
    // arrow detaches from the target. Pin `top` so it's placed (and its arrow
    // aligned) against the spotlighted button from the start.
    side: 'top',
  },
  {
    surface: 'base-map-panel',
    target: '[data-tour="basemap"]',
    titleKey: 'onboarding.tour.basemap.title',
    bodyKey: 'onboarding.tour.basemap.body',
    labelKey: 'onboarding.tour.labels.basemap',
  },
]
