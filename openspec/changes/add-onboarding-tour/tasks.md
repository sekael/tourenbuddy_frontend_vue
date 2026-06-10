## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/186-onboarding-tour`

## 2. Database

- [x] 2.1 Create migration: `supabase migration new add_onboarding_tour_state`
- [x] 2.2 In the generated file add `alter table public.user_profile add column onboarding_tour_show_at_sign_in boolean not null default true, add column onboarding_tour_last_step integer not null default 0;` (no backfill UPDATE — existing users get one auto-show). Do NOT edit any existing migration.
- [x] 2.3 Apply locally with `supabase db reset` and verify both columns exist

## 3. Profile data layer

- [x] 3.1 Add `onboardingTourShowAtSignIn: z.boolean()` and `onboardingTourLastStep: z.number().int()` to `userProfileSchema`, and map `onboarding_tour_show_at_sign_in` / `onboarding_tour_last_step` in `userProfileRowSchema` (row-schema fields `.default()` so DB rows + fixtures parse) (`src/features/user/data/models/user-profile-schema.ts`)
- [x] 3.2 Update `UserProfileRepositoryImpl` upsert/select so both fields round-trip (snake_case ↔ camelCase); ensure default rows parse
- [x] 3.3 Update any `upsertProfile({...})` literals (e.g. `loadProfile`'s initial upsert in `user-profile-store`) to include `onboardingTourShowAtSignIn: true, onboardingTourLastStep: 0`

## 4. Profile store

- [x] 4.1 Add a `dismissTourAtSignIn()` action → `updateProfile({ onboardingTourShowAtSignIn: false })`, logs+swallows errors (non-blocking)
- [x] 4.2 Add a `saveTourStep(n: number)` action → `updateProfile({ onboardingTourLastStep: n })`, logs+swallows errors
- [x] 4.3 Expose both actions + the two fields from the store; confirm reads use `store.profile?.onboardingTourShowAtSignIn` / `?.onboardingTourLastStep` (no new realtime subscription — piggybacks existing `user_profile` channel)

## 5. Onboarding tour module

- [x] 5.1 Add dependency: `npm install driver.js` (installed 1.4.0)
- [x] 5.2 Create `src/features/onboarding/presentation/onboarding-steps.ts` — declarative step descriptors `{ surface: TourSurface, target: '[data-tour="..."]', titleKey, bodyKey }` for the 5 steps in order: phone-verification, notifications, contacts, tours, basemap (surface, not OverlayName — contacts/basemap live in the speed-dial)
- [x] 5.3 Create `src/features/onboarding/presentation/composables/use-onboarding-tour.ts` wrapping driver.js: accepts a `stage(surface)` callback + `cleanup` + store actions + gate reads; enable Next/Previous (bidirectional); manual `driver.highlight()` per step (driver.js does not await hooks); `goToStep` awaits `stage` + a `waitForElement` poll (MutationObserver + timeout, resolves null on miss), re-checks `driverObj` after the awaits (teardown-during-wait guard), skips the step (in travel direction) if the target never appears
- [x] 5.4 Configure driver.js interaction: `overlayClickBehavior: () => advance()` (backdrop tap advances), `allowClose: false` (no backdrop/Escape dismiss), `showButtons: ['previous','next','close']` with the `close` button relabelled "Finish tour" via `onPopoverRender` as the only dismiss, `disableActiveInteraction: true` (highlighted control inert)
- [x] 5.5 Expose `startTour(fromStep)` (bypasses gate, used by reopen; clamps index to `[0, steps.length - 1]`) and `maybeStartTour()` (auto-start: only when authenticated, profile loaded, `onboardingTourShowAtSignIn === true`, not already running via internal `isRunning` ref; runs regardless of profile completeness). `maybeStartTour` resumes at `onboardingTourLastStep` and calls `dismissTourAtSignIn()` on start
- [x] 5.6 On "Finish tour" persist current index via `saveTourStep(currentIndex)`; on advancing past the final step persist `saveTourStep(0)`
- [x] 5.7 Create `src/features/onboarding/presentation/stores/onboarding-tour-store.ts` — tiny Pinia store with a `requestReopen()` action + reactive `reopenSignal` counter for `map-page.vue` to watch (cross-overlay trigger)
- [x] 5.8 driver.js popover/overlay z-index sits above sheets by default (driver uses a very high z-index vs. sheets' 50); `popoverClass: 'onboarding-tour-popover'` set as a styling hook if a bump is ever needed

## 6. Anchor targets

- [x] 6.1 Add `data-tour="contacts"` to the speed-dial contacts item (`map-speed-dial-menu.vue`, conditional on `item.id === 'contacts'`, falls through to the item's `<button>`)
- [x] 6.2 Add `data-tour="tours"` to the "My tours" segment in `tour-action-bar.vue`
- [x] 6.3 Add `data-tour="basemap"` to the base-map panel root (`map-base-map-panel.vue`)
- [x] 6.4 Add `data-tour="phone-verification"` to the always-present `.phone-row` container in `user-profile-sheet.vue`, and `data-tour="notifications"` to a wrapper around `NotificationPreferencesSection`
- [x] 6.5 Expose `openMenu()` / `openBaseMap()` from `map-action-overlay.vue` so `stage()` can drive the speed-dial surfaces

## 7. Map page integration

- [x] 7.1 In `map-page.vue`, wire `use-onboarding-tour`, passing `stage` (surface → open calls), `cleanup`, the store actions (`dismissTourAtSignIn`, `saveTourStep`), and the gate reads
- [x] 7.2 Call `maybeStartTour()` from `onMounted` after the existing `loadProfile()` resolves (only once profile is loaded, per spec)
- [x] 7.3 Watch `onboardingTourStore.reopenSignal` in `map-page.vue` → call `startTour(onboardingTourLastStep)`

## 8. Reopen from profile sheet

- [x] 8.1 Add a "Show app tour" action (localized) to `user-profile-sheet.vue`
- [x] 8.2 Activating it emits `close` (to dismiss the sheet) and calls `onboardingTourStore.requestReopen()`; `map-page.vue` reacts (task 7.3) by starting the tour at the last step. No event threading through the overlay container

## 9. i18n

- [x] 9.1 Add to `src/locales/en.json` under a dedicated top-level `onboarding.tour.*` namespace: title/body for all 5 steps (phone copy sells the benefit), the `next`/`previous`/`done`/`finish` ("Finish tour") control labels, and the `reopen` ("Show app tour") label
- [x] 9.2 Add the same keys with translations to `src/locales/de-CH.json`

## 10. Tests

- [x] 10.1 Unit-test the auto-start guard: does NOT start when gate closed, starts + dismisses + highlights step 0 when open, does not start twice while running
- [x] 10.2 Unit-test resume + clamp: resumes at `onboardingTourLastStep`; out-of-range high index clamps to last, negative clamps to 0
- [x] 10.3 Unit-test step persistence: dismiss mid-sequence persists current index; advancing past final persists `0`; store action swallows a persistence failure (separate store test)
- [x] 10.4 Test missing-target step is skipped (fake-timers; resolves after `waitForElement` timeout) and the async-staged target is awaited (gap verifier, now un-skipped and passing)
- [x] 10.5 Run `npm run test` — all pass (991 passed)

## 11. Finalize

- [x] 11.1 Run `npx eslint . --fix` (zero warnings) and `npm run type-check` (both clean); diff is antfu-clean
- [ ] 11.2 Manually verify locally against local Supabase — **mobile/bottom-sheet layout first** (primary audience), then desktop: new user sees the 5-step tour, backdrop tap advances, Next/Previous work, "Finish tour" is the only dismiss, highlighted control is inert, popover sits above sheets (z-index); it does not auto-show again at sign-in; reopen from profile resumes at last step; finishing then reopening replays from step 1
- [ ] 11.3 Prompt the user to commit with conventional message: `feat(onboarding): guided onboarding tour for new users (#186)`
- [ ] 11.4 Prompt the user to push and open a PR to `main`; note `supabase db push` is a separate user-approved deploy step
