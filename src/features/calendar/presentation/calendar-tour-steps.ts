import type { OnboardingStep } from '@/features/onboarding/presentation/onboarding-steps'

/**
 * Declarative steps for the calendar spotlight tour, reusing the onboarding
 * `OnboardingStep` shape + `useOnboardingTour` composable (see
 * `use-onboarding-tour.ts`). `calendar-page.vue` owns the concrete `stage`
 * function that opens each surface (switch to the seasons view, etc.).
 *
 * Covers issue #248 steps 2–4: edit availability, meaning of the day-chips
 * (shown as demo chips — a new user has no real data), and the seasonal overview.
 */
export const CALENDAR_TOUR_STEPS: OnboardingStep[] = [
  {
    // Planned view is the default; the FAB is always visible there.
    surface: 'availability',
    target: '[data-tour="availability-edit"]',
    titleKey: 'calendar.tour.availability.title',
    bodyKey: 'calendar.tour.availability.body',
    labelKey: 'calendar.tour.labels.availability',
    // The FAB sits bottom-right; place the popover above it so it can't overflow
    // the viewport bottom (where driver.js would flip it into the banner).
    side: 'top',
  },
  {
    // The demo chips render on the today cell while the tour runs (belt-and-
    // suspenders gated). The cell carries the `demo-chips` anchor.
    surface: 'day-chips',
    target: '[data-tour="demo-chips"]',
    titleKey: 'calendar.tour.dayChips.title',
    bodyKey: 'calendar.tour.dayChips.body',
    labelKey: 'calendar.tour.labels.dayChips',
  },
  {
    // The stage switches to the seasons view (spotlighting the seasons nav first)
    // and a demo season bar renders so the axis isn't the zero-tour disclaimer.
    surface: 'seasons',
    target: '[data-tour="demo-season"]',
    titleKey: 'calendar.tour.seasons.title',
    bodyKey: 'calendar.tour.seasons.body',
    labelKey: 'calendar.tour.labels.seasons',
  },
]
