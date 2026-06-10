/**
 * Declarative descriptors for the onboarding spotlight tour.
 *
 * Each step names the *surface* that must be staged (opened) before its target
 * can be highlighted, plus the `data-tour` selector of the element to spotlight
 * and the i18n keys for its copy. `map-page.vue` maps each surface to the
 * concrete open/close calls (it owns `activeOverlay` and the speed-dial refs);
 * the tour composable only knows surfaces, not how to open them.
 */

/** The on-screen surface a step's target lives in. */
export type TourSurface
  = | 'profile' // user profile sheet (activeOverlay = 'profile')
    | 'speed-dial-menu' // expanded speed-dial menu (contacts item)
    | 'base-map-panel' // speed-dial base-map switcher panel
    | 'tour-bar' // always-visible bottom tour action bar

export interface OnboardingStep {
  /** Surface to stage before highlighting. */
  surface: TourSurface
  /** CSS selector for the spotlight target (a stable `data-tour` anchor). */
  target: string
  /** i18n key for the popover title. */
  titleKey: string
  /** i18n key for the popover body. */
  bodyKey: string
}

/** The five onboarding steps, in presentation order. */
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
  },
  {
    surface: 'speed-dial-menu',
    target: '[data-tour="contacts"]',
    titleKey: 'onboarding.tour.contacts.title',
    bodyKey: 'onboarding.tour.contacts.body',
  },
  {
    surface: 'tour-bar',
    target: '[data-tour="tours"]',
    titleKey: 'onboarding.tour.tours.title',
    bodyKey: 'onboarding.tour.tours.body',
  },
  {
    surface: 'base-map-panel',
    target: '[data-tour="basemap"]',
    titleKey: 'onboarding.tour.basemap.title',
    bodyKey: 'onboarding.tour.basemap.body',
  },
]
