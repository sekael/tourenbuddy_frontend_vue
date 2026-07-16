## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/248-guided-tour-calendar-steps`

## 2. Database — calendar-tour gate

- [x] 2.1 `supabase migration new add_calendar_tour_gate`; add `alter table public.user_profile add column calendar_tour_show_on_first_open boolean not null default true;` (no grants — column-add on already-granted table; no backfill — `default true` is the one-time auto-show)
- [x] 2.2 `supabase db reset` locally; verify the column exists and defaults to `true`

## 3. User profile — persist the gate

- [x] 3.1 Add `calendarTourShowOnFirstOpen: z.boolean()` to the domain schema and `calendar_tour_show_on_first_open` (row default `true`) to the DB row schema + mapping in `user-profile-schema.ts`
- [x] 3.2 Persist the field in `user-profile-repository-impl.ts` upsert; add the default in the store's local-profile fallback (`user-profile-store.ts`)
- [x] 3.3 Add a `dismissCalendarTour()` store action (flips the gate to `false` via `updateProfile`, non-blocking) mirroring `dismissTourAtSignIn`

## 4. Reuse the tour composable across routes

- [x] 4.1 Parameterize `useOnboardingTour` to accept an injected `steps: OnboardingStep[]` option instead of importing `ONBOARDING_STEPS` directly (keep the map-page call passing `ONBOARDING_STEPS`); confirm `currentTitle`/`totalSteps` read from the injected array
- [x] 4.2 Add a `startCalendarTour` flag to the `pendingIntent` type on `map-store` (used only for the map→calendar hand-off)

## 5. Onboarding (map) tour — calendar step + hand-off

- [x] 5.1 Add a `data-tour="open-calendar"` anchor to the calendar-open button in `tour-list-sheet.vue` header
- [x] 5.2 Add the 9th step to `ONBOARDING_STEPS` (surface `tours`, target `[data-tour="open-calendar"]`, new i18n keys); it spotlights the button without navigating
- [x] 5.3 On map-tour `finishCompleted`, set `pendingIntent = { startCalendarTour: true }` and `router.push({ name: 'calendar' })`; ensure early "Finish tour" dismissal does NOT set the intent (the calendar-side gate decides whether the tour actually starts — task 6.5)

## 6. Calendar tour — steps, stage, host

- [x] 6.1 Create `features/calendar/presentation/calendar-tour-steps.ts` with the 3 steps (availability edit, demo chips, seasonal overview) reusing the `OnboardingStep` shape
- [x] 6.2 Add `data-tour` anchors: availability edit FAB (`calendar-page.vue`), the seasons nav control (`calendar-nav.vue`), and the seasonal overview / demo season bar (`seasons-gantt.vue`, `data-tour="demo-season"`)
- [x] 6.3 In `calendar-page.vue`, instantiate `useOnboardingTour` with the calendar steps and a calendar `stage` function (switches to the seasons view + spotlights the seasons nav control for the overview step); wire `saveTourStep`/`getResumeStep` as no-op/0; wire `cleanup()` to switch the view back to `planned`
- [x] 6.4 Add optional `titleKey`/`bodyKey` props to `onboarding-welcome.vue` (default to the existing onboarding keys); render the calendar tour banner + welcome (reusing the banner + parameterized welcome) teleported to `<body>`, and apply the same scroll-lock treatment as the map page
- [x] 6.5 In `onMounted`, implement the single gate rule (Decision 2): consume the `startCalendarTour` intent regardless; if intent present AND gate `true` → start directly + flip gate; if intent present AND gate `false` → nothing; if no intent AND gate `true` → show welcome; wire welcome actions (start/don't-show-again flip gate; skip leaves it)
- [x] 6.6 Add an always-visible "replay calendar tour" control on the calendar page that calls the tour's `startTour(0)` directly (bypasses the gate; no cross-route signal), placed with the existing top-bar/view-nav chrome

## 7. Demo content (belt-and-suspenders)

- [x] 7.1 Define hardcoded demo constants in the calendar-tour module: demo chips (one tour chip + one friend chip) and one demo season bar — never written to any store
- [x] 7.2 Planned view: pass a gated `demo-chips` prop (null when inactive) from `calendar-page.vue` → `planned-calendar.vue`, fed into `<DayPreview>` for the today cell only; the today cell carries `data-tour="demo-chips"`. Keep it out of the real `entriesFor`/`friendsFor` path
- [x] 7.3 Seasons view: gated demo season bar branch in `seasons-gantt.vue` (`v-if="tourActive"`) rendering the axis + demo bar instead of the zero-tour disclaimer
- [x] 7.4 Drive the `tourActive`/`demo-chips` props from the tour instance's `isRunning` so all demo content vanishes on any tour exit

## 8. i18n

- [x] 8.1 Add all new keys (map calendar step, calendar welcome title/body, 3 calendar step titles/bodies/labels, seasons nav hint, demo chip + demo season names, replay button label) to `en.json` AND `de-CH.json`

## 9. Tests (edge cases / failures only)

- [x] 9.1 Test: demo chips + demo season bar are absent when the calendar tour is not running, and present only in the right view while running
- [x] 9.2 Test: map-tour completion sets the hand-off intent + navigates; early dismissal does not
- [x] 9.3 Test the gate rule: hand-off + fresh gate → starts directly + flips gate; hand-off + spent gate → nothing (intent still consumed); no intent + fresh gate → welcome; replay button → starts regardless of gate
- [x] 9.4 Run `npm run test` — all pass

## 10. Finalize

- [x] 10.1 `npx eslint . --fix`; review the diff size (guard against editor reformat noise), `npm run type-check`
- [ ] 10.2 Prompt the user to commit (do NOT commit): `feat(calendar): add guided tour steps for calendar & availability (#248)`
- [ ] 10.3 Prompt the user to push and open a PR to `main`
- [ ] 10.4 Prompt the user to `supabase db push` after review (prod deploy step — do NOT run unprompted)
- [ ] 10.5 After merge, prompt the user to archive this change with the openspec-archive skill
