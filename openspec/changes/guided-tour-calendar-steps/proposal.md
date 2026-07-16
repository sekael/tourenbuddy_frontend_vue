## Why

The calendar and availability features (planned view, availability editing, friend/tour day-chips, seasonal overview) shipped without any guided-tour coverage, so new users have no in-app introduction to them (issue #248). The existing onboarding tour stops at the map and never mentions the calendar.

## What Changes

- Add one step to the **onboarding (map) tour** that spotlights the "open calendar" button in the My Tours sheet header — teaching new users where the calendar lives (issue step 1).
- Introduce a new **calendar-hosted spotlight tour** covering three steps: editing availability, the meaning of friend/tour day-chips (shown as demo chips, since a new user has no real data), and navigating to the seasonal overview (issue steps 2–4).
- **Auto-chain**: when the onboarding tour is completed (advanced past its last step), it hands off toward `/calendar`; the calendar tour then starts **only if** the calendar gate is still set (see below), so a returning user who replays only the map tour is not surprised by a repeat.
- **Standalone first-open trigger**: for users who already completed onboarding before this feature, the calendar tour's welcome appears the first time they open the calendar.
- **Manual replay**: a "replay calendar tour" button on the calendar page (the calendar analogue of the profile-sheet "Show app tour") starts the calendar tour on demand, bypassing the gate.
- Persist a new gate `user_profile.calendar_tour_show_on_first_open` (default `true`, flips `false` once the tour is shown) mirroring the existing `onboarding_tour_show_at_sign_in` gate. This one gate governs every *automatic* trigger uniformly.
- Render **demo content** only while the calendar tour is active — **demo day-chips** (one fake tour chip + one fake friend chip on the today cell) for the chip step, and a **demo season bar** for the seasonal-overview step (the seasons view otherwise shows only a "no tours" disclaimer for a new user). Belt-and-suspenders gated so demo data never renders outside the tour and never touches the stores or DB.

## Capabilities

### New Capabilities
- `calendar-tour`: The calendar-hosted spotlight tour — its gate + trigger rule (auto-chain / standalone welcome / manual replay), its three steps (availability edit, demo day-chips, seasonal overview navigation), the demo-content (chips + season bar) rendering rules, and the completion/persistence behavior.

### Modified Capabilities
- `onboarding-tour`: Adds the "open calendar" step and the completion-time hand-off that navigates toward `/calendar` (the calendar tour then starts per its own gate).

## Impact

- **DB**: new migration adding `user_profile.calendar_tour_show_on_first_open` (column-add on an already-granted table; no new grants needed).
- **Frontend**:
  - `features/user`: profile schema, store, repository — new gate field + a `dismissCalendarTour` action.
  - `features/onboarding`: `onboarding-steps.ts` (+1 step), `use-onboarding-tour.ts` (parameterize the steps array so the composable is reusable), completion hand-off wiring; `onboarding-welcome.vue` gains optional `titleKey`/`bodyKey` props.
  - `features/calendar`: `calendar-page.vue` instantiates the reused tour composable with new `calendar-tour-steps.ts`, its own stage function, banner, welcome, gate/trigger rule, cleanup-to-planned, and a replay button; `planned-calendar.vue` gains a gated demo-chips prop fed into `<DayPreview>` on the today cell; `seasons-gantt.vue` gains a gated demo season bar; both plus `calendar-nav.vue` gain `data-tour` anchors.
  - `map-store` (or equivalent) `pendingIntent` gains a `startCalendarTour` flag for the hand-off.
  - i18n: new keys in `en.json` and `de-CH.json`.
- **No** breaking changes; no Worker changes.
