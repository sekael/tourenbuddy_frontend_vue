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
    // suspenders gated). The cell is a waypoint; the opened detail overview is
    // the final target for the explanatory popover.
    surface: 'day-chips',
    target: '[data-tour="demo-detail"]',
    titleKey: 'calendar.tour.dayChips.title',
    bodyKey: 'calendar.tour.dayChips.body',
    labelKey: 'calendar.tour.labels.dayChips',
    // The detail overview may open as a mobile sheet; center it below the banner.
    scrollBlock: 'center',
  },
  {
    // The stage switches to the seasons view (spotlighting the seasons nav first)
    // and a demo season bar renders so the axis isn't the zero-tour disclaimer.
    surface: 'seasons',
    // Spotlight the demo ROW itself (not the whole track). Banner clearance +
    // column fit come from the `.calendar-canvas.tour-seasons` overrides in
    // calendar-page.vue (padding-top pushes the sticky header below the fixed
    // banner; the narrowed label + zero season-floor keep all four columns in
    // view so the tour-name label shows without horizontal scroll). The demo row
    // is the first row, so driver.js' center-scroll clamps to the top and leaves
    // the header visible. `block:'nearest'` minimizes our own pre-scroll motion.
    target: '[data-tour="demo-row"]',
    scrollBlock: 'nearest',
    titleKey: 'calendar.tour.seasons.title',
    bodyKey: 'calendar.tour.seasons.body',
    labelKey: 'calendar.tour.labels.seasons',
  },
]
