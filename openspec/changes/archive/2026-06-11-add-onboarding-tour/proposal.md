## Why

Newly registered users land on the map after the profile form ([[profile-onboarding]]) with no guidance on the app's core features (phone verification, notification settings, contacts, tours, switching basemaps). They miss capabilities that drive the app's value. A one-time, skippable guided tour highlighting these features in place improves feature discovery and understanding. (GitHub issue #186; the external documentation site from the same issue is split into its own change.)

## What Changes

- Add a skippable in-app **guided spotlight tour** auto-shown on first arrival at the map after onboarding. It highlights, in order: phone verification, notification settings, contacts, tours, switching maps.
- The tour drives the single `/map` page: it programmatically opens the relevant overlay (profile sheet for phone verification + notification settings; contacts/tours/basemap controls) before highlighting each target element, and closes it on advance.
- Spotlight + explanatory tooltip per step; **non-blocking** — highlighted controls are inert, the user navigates **forward and backward**, a backdrop tap advances, and dismissal is only via an explicit **"Finish tour"** button. It never forces the user to complete an action.
- Add a **"Show app tour" entry in the user profile sheet** so the user can reopen the tour at any time (via a small Pinia signal store watched by the map page). A reopen resumes from the last seen step.
- Persist two data points on `user_profile`, synced via the existing realtime channel: `onboarding_tour_show_at_sign_in` (auto-start gate; flips to `false` once the tour is first displayed at sign-in, so it never auto-shows again) and `onboarding_tour_last_step` (resume point, updated as the user navigates). Finishing the whole tour resets `last_step` to `0` so a later reopen replays from the start.
- Add `driver.js` as a dependency for the spotlight/overlay mechanics.
- All tour copy added as `vue-i18n` keys for every locale (`en`, `de-CH`).

## Capabilities

### New Capabilities
- `onboarding-tour`: One-time, skippable guided spotlight tour introducing core features to new users, with cross-device completion persistence.

### Modified Capabilities
<!-- No requirement changes to existing capabilities. profile-onboarding is referenced but its requirements are unchanged; the tour begins after onboarding completes/skips. -->

## Impact

- **New deps:** `driver.js`.
- **DB:** new migration adding `onboarding_tour_show_at_sign_in boolean not null default true` and `onboarding_tour_last_step integer not null default 0` to `public.user_profile` (RLS/grants already cover the table; columns inherit existing row policies).
- **Schema/entity:** `user-profile-schema.ts` + `UserProfile` entity gain the two new fields; repository row mapping updated.
- **Store:** `user-profile-store` exposes the two fields + actions: `dismissTourAtSignIn()` (sets show-at-sign-in `false`), `saveTourStep(n)` (persists `last_step`).
- **New feature module:** `features/onboarding/` — `use-onboarding-tour` composable (driver.js wrapper), `onboarding-steps.ts` descriptors, and `onboarding-tour-store` (cross-overlay reopen signal).
- **Map page:** `map-page.vue` wires the tour controller and exposes stable anchor targets (data attributes) on the speed-dial contacts button, tour action bar, basemap panel trigger, and profile-sheet phone/notification sections.
- **Profile sheet:** `user-profile-sheet.vue` gains a "Show app tour" action that starts the tour at `last_step`.
- **i18n:** new keys in `en.json` + `de-CH.json`.
- **No backend/Worker changes.**
