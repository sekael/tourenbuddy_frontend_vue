## Context

The onboarding tour is a single-route spotlight tour instantiated in `map-page.vue` via `useOnboardingTour` (`features/onboarding/presentation/composables/use-onboarding-tour.ts`). It tears itself down on `onBeforeRouteLeave` because driver.js appends its overlay to `<body>` and would orphan it on navigation. Steps are declarative (`onboarding-steps.ts`); each names a `surface` that `map-page.vue`'s `stageTourSurface` opens before spotlighting.

The calendar (`/calendar`) is a **separate route**, reached from the My Tours sheet header button (`tour-list-sheet.vue` → `router.push({ name: 'calendar' })`). Map ↔ calendar already exchange a one-shot `pendingIntent` on `map-store` (e.g. `openTours`, `selectTourId`, `origin`).

Persistence for the onboarding tour lives on `user_profile`: `onboarding_tour_show_at_sign_in` (auto-start gate, flips false once shown) and `onboarding_tour_last_step` (resume index). Migration `20260609162756_add_onboarding_tour_state.sql` is the reference shape.

A brand-new user — the tour's audience — has no tours and no friends, so the real day-chips (`.pill`, `.friend-chip` in `day-preview.vue`) never render. Issue #248 explicitly calls for showing **fake chips**.

## Goals / Non-Goals

**Goals:**
- Cover issue #248's four steps: navigate to calendar, edit availability, meaning of friend/tour chips (demo chips), navigate + view the seasonal overview.
- Reuse the existing driver.js choreography (mask timing, `waitForPosition`, `refreshAfterMotion`) rather than re-implementing it.
- Two trigger paths that converge cleanly: auto-chain after onboarding completion (new users + reopen), and standalone first-open (already-onboarded users).
- Demo chips that provably cannot render outside the tour and never persist.

**Non-Goals:**
- No single continuous route-spanning tour engine (rejected below).
- No shared progress counter across the map and calendar tours — each shows its own "step X of N".
- No Worker or notification changes.

## Decisions

### Decision 1: Calendar owns a second tour instance (Option B), not a route-spanning engine

The calendar page instantiates its **own** `useOnboardingTour` with a calendar-specific steps array and stage function. Rationale: the requirement that the calendar tour run *standalone* on first calendar open (for already-onboarded users) is not expressible as a single continuous tour — a route-spanning engine would still need a separate entry point for that case. Two instances that each own their route match the existing single-route teardown model and the existing `pendingIntent` handoff pattern, avoiding a risky refactor of the mask/teardown logic.

To reuse the composable, `ONBOARDING_STEPS` is promoted from a hard import to an injected `steps: OnboardingStep[]` option. This is the only structural change to the composable; all choreography stays put. `currentTitle` already reads from the injected steps, so it follows for free.

**Alternative considered — Option A (lift to a store, one continuous tour):** rejected. Bigger blast radius (teardown, route-leave, dual-page staging), and still needs a bespoke standalone-start path, so it does not actually simplify the two-trigger requirement.

### Decision 2: One gate rule governs every trigger

Whenever the **map** tour reaches `finishCompleted` (user advanced past the last step), it sets `pendingIntent = { startCalendarTour: true }` and `router.push({ name: 'calendar' })`. Because the profile-sheet "Show app tour" reopen replays the map tour to completion, it flows through the same hook — no separate reopen wiring.

`calendar-page.vue` `onMounted` then applies a single rule keyed on the gate `calendar_tour_show_on_first_open`:

| On mount | Gate `true` | Gate `false` |
| --- | --- | --- |
| Hand-off intent present (map tour just finished) | start the tour **directly** (no welcome), flip gate `false` | do nothing (respect the gate — user already saw it) |
| No intent (plain calendar open) | show the **welcome** (standalone first-open) | do nothing |

The hand-off intent is consumed on mount regardless, so it never re-fires. The gate is the source of truth for *automatic* triggers: a returning user who already saw the calendar tour is never auto-shown it again, even when they replay the map tour. Deliberate manual replay is the one bypass (Decision 7).

**Note (reopen respects the gate — resolved with the user):** an earlier draft had reopen always chain into the calendar unconditionally. That was rejected: the gate governs all automatic triggers uniformly, and a manual calendar-replay button (Decision 7) covers the "I actually want to see it again" case without surprising a user who only wanted the map tour.

### Decision 3: One new gate column, no resume index

Add `user_profile.calendar_tour_show_on_first_open boolean not null default true`, mirroring `onboarding_tour_show_at_sign_in`. `default true` grants every existing user exactly one auto-show (feature discovery), so no backfill UPDATE — same intent as the onboarding migration. The calendar tour is 3 steps; a mid-tour resume index (`last_step`) is not worth a column — dismissing simply flips the gate. `saveTourStep`/`getResumeStep` are wired to no-op / return 0 for this instance.

### Decision 4: Welcome screen — parameterize the existing component

`OnboardingWelcome` is pure presentation over injected i18n keys, so it gains optional `titleKey` / `bodyKey` props defaulting to the existing `onboarding.tour.welcome.*` keys. The calendar page passes calendar-specific copy ("Get to know your calendar"); the three action labels (Start / Skip for now / Don't show again) stay shared — they are generic. Rejected: reusing the app-level onboarding copy verbatim (wrong for a user already inside the app), and a duplicate calendar-welcome component (needless markup fork).

The auto-chain path arrives mid-flow, so it starts the calendar tour directly (no welcome — see Decision 2). The standalone first-open path shows the welcome. "Skip for now" leaves the gate `true` (returns next open); "Start" and "Don't show again" flip it `false`.

### Decision 5: Demo data — gated presentational render, belt-and-suspenders

Two demo artifacts are needed because a brand-new user has no data: **demo day-chips** (one tour chip + one friend chip) on the planned view, and a **demo season bar** on the seasons view (`seasons-gantt.vue` otherwise shows only a "no tours" disclaimer for zero-tour users, which would make the seasonal-overview step spotlight an empty message). Both follow the same isolation contract:

1. **Source isolation** — each demo artifact is a hardcoded module constant in the calendar-tour code, never written to `availabilityStore` / `toursStore`, so no store or DB path can ever surface it.
2. **Render gate** — a dedicated branch gated on the tour-active flag (e.g. `v-if="demoChips && isDemoCell(date)"` on the today cell; `v-if="tourActive"` for the season bar), separate from the real render, so a real render can never fall through to it.
3. **Lifecycle tie** — the tour-active flag is the tour instance's `isRunning`, forwarded by prop from `calendar-page.vue` (which owns the tour) down to `planned-calendar.vue` / `seasons-gantt.vue`. The composable drives `isRunning` to `false` on teardown/route-leave/unmount, so both demo artifacts vanish the instant the tour ends by any exit path — and cleanup resets the view to planned (Decision 6), so a stale demo season bar never lingers.

The planned demo chips reuse `<DayPreview>` (fed hardcoded demo `entries` / `friends` for the today cell) — identical rendering is the point, since the step teaches what *real* chips look like. The day-chip step first spotlights the demo cell (`data-tour="demo-chips"`) as a waypoint, then opens that day's detail overview and spotlights the detail panel (`data-tour="demo-detail"`) so the user sees the same tour/friend chips expanded. The demo season row carries `data-tour="demo-row"`.

### Decision 6: Calendar-tour cleanup resets to the planned view

The seasonal-overview step ends on the seasons view. On any tour exit, `cleanup()` switches the calendar back to the planned view (`router.replace({ view: 'planned' })`), mirroring the onboarding tour's cleanup that restores a neutral state. This lands the user on the calendar's default view rather than an emptied seasons chart, and guarantees the demo season bar is off-screen once the tour-active flag drops.

### Decision 7: Manual calendar-tour replay button

The calendar page gains a "replay calendar tour" control — the calendar analogue of the profile-sheet "Show app tour". Because it lives *on* the calendar page, it calls the tour instance's `startTour(0)` directly and bypasses the gate; it needs no cross-route `reopenSignal` (unlike onboarding's profile→map reopen). It is always visible, placed with the existing calendar chrome (near the top bar / view nav). This is the sanctioned way for a returning user to see the calendar tour again, since automatic triggers respect the gate (Decision 2).

### Decision 8: One-time sign-in notice for already-onboarded users

Existing users who completed the previous onboarding tour can have `onboarding_tour_show_at_sign_in = false` and `onboarding_tour_last_step = 0`, so they will not see the new final map step that points to the calendar. Do **not** reuse `calendar_tour_show_on_first_open` for the sign-in notice: dismissing the notice must not suppress the real calendar tour that starts when they later open `/calendar`.

Add `user_profile.calendar_feature_notice_show_at_sign_in boolean not null default false`. Backfill it to `true` only for rows with `onboarding_tour_show_at_sign_in = false`, `onboarding_tour_last_step = 0`, and `calendar_tour_show_on_first_open = true`. New/future users default to `false` because they see the normal onboarding calendar step. The map page shows a small dismissible notice on startup when this flag is `true`, explaining My Tours -> Calendar. Any exit from the notice flips only this notice flag to `false`; the calendar-tour gate stays untouched, so navigating to the calendar still starts the calendar tour naturally.

## Risks / Trade-offs

- **Two progress counters** ("step 1 of 3" on calendar after "step 8 of 8" on the map) → Accepted per the architecture choice; the auto-navigation + a fresh banner reads as "next chapter," not a bug.
- **Auto-navigating a new user to another route on onboarding finish** could feel abrupt → Mitigation: the calendar tour starts immediately on arrival so there is no bare-calendar flash; the hop is framed by the first calendar step.
- **Demo data (chips + season bar) leaking into real views** → Mitigation: the three-layer isolation in Decision 5; add tests asserting both demo artifacts are absent when the tour is not running.
- **Notice dismissal suppressing the actual calendar tour** → Mitigation: separate notice gate from `calendar_tour_show_on_first_open`; notice dismissal updates only the notice flag.
- **Composable refactor (inject `steps`) regressing the map tour** → Mitigation: mechanical change (import → option); existing onboarding tests cover the map instance.
- **Returning user replays the map tour and is surprised by a calendar chapter** → Resolved by Decision 2 (automatic triggers respect the gate, so no surprise chain) + Decision 7 (an explicit calendar-page replay button for deliberate re-viewing).

## Migration Plan

1. `supabase migration new add_calendar_tour_gate` → add `calendar_tour_show_on_first_open boolean not null default true` and `calendar_feature_notice_show_at_sign_in boolean not null default false`; backfill the notice flag to `true` only for already-onboarded rows (`onboarding_tour_show_at_sign_in = false`, `onboarding_tour_last_step = 0`, `calendar_tour_show_on_first_open = true`).
2. `supabase db reset` locally, verify column + defaults.
3. Ship frontend. `supabase db push` to prod is a prompted deploy step, run after review.
4. Rollback: the column is additive and defaulted; reverting the frontend leaves an unused column (harmless). No data migration to undo.

## Open Questions

None outstanding. Resolved with the user across two rounds: the four upstream forks (Option B, presentational demo chips, auto-chain on finish, reopen reuse) and six follow-ups from the grill (demo-chip mechanism = reuse `DayPreview` via prop; demo season bar for the seasons step; cleanup resets to planned; welcome copy parameterized; reopen respects the gate + adds a calendar-page replay button; primed navigation hop accepted). Follow-up issue #255 tracks applying the same demo-data pattern to the onboarding tour's contacts/tours steps.
