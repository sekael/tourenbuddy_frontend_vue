## Context

The app is effectively a single screen: `map-page.vue` hosts the MapLibre map plus a set of mutually-exclusive overlays (`activeOverlay` ref) opened from `MapActionOverlay` (speed-dial: profile, contacts, feedback) and `TourActionBar` (tours list, add tour). The features issue #186 wants to introduce live behind these controls:

- **Phone verification** + **notification settings** → inside `UserProfileSheet` (notification UI = `notification-preferences-section.vue`).
- **Contacts** → speed-dial contacts button in `MapActionOverlay`.
- **Tours** → `TourActionBar`.
- **Switching maps** → `map-base-map-panel.vue` trigger.

Profile completion already gates `/onboarding` (see `profile-onboarding`); the tour begins *after* that, on the map. Completion state lives on `user_profile`, which is already realtime-synced (`user-profile-store`).

## Goals / Non-Goals

**Goals:**

- Skippable, bidirectional spotlight tour over the 5 features, in order, driven from the existing single map page.
- Auto-show once at sign-in, plus on-demand reopen from the profile sheet that resumes at the last seen step. Cross-device via DB-persisted state.
- Reuse existing overlay-open mechanics and the existing profile realtime sync; no new backend/Worker work.
- Copy fully localized.

**Non-Goals:**

- The external documentation site (Docusaurus) — split to a separate change.
- Forcing or verifying completion of any step (no guided completion).
- Changing the existing `profile-onboarding` form flow.

## Decisions

### D1: `driver.js` for spotlight + tooltips

Chosen over Shepherd.js (heavier) and a custom overlay (most work; must reimplement positioning, scroll, escape handling). `driver.js` is ~5kb, dependency-free, framework-agnostic, and exposes an imperative API (`driveStep`, `moveNext`, hooks like `onHighlightStarted`/`onDeselected`, `onDestroyStarted`) that fits driving Vue overlays between steps. We wrap it in a composable so feature code never touches the library directly (mirrors how `supabase.channel` is wrapped by `use-realtime-subscription`).

### D2: New `features/onboarding/` module (presentation-only)

No domain/data layer needed — there's no new persisted entity beyond a column on the existing `user_profile`. Structure:

- `presentation/composables/use-onboarding-tour.ts` — wraps driver.js: builds the localized step list, runs the sequence, calls an injected `openOverlay`/`closeOverlay` to stage targets, and invokes `onComplete` when finished/skipped.
- `presentation/onboarding-steps.ts` — declarative step descriptors: `{ overlay: OverlayName | null, target: data-attr selector, titleKey, bodyKey }`.
- `presentation/stores/onboarding-tour-store.ts` — a tiny Pinia store carrying the cross-overlay reopen signal (see D6).

`map-page.vue` owns `activeOverlay` (and, via `mapOverlayRef`, the speed-dial), so it is the natural integration point: it instantiates the composable, passes a `stage(surface)` callback (plus `cleanup`, the persistence actions, and the gate reads) in, triggers `maybeStartTour()` from `onMounted` after `loadProfile()` resolves, and watches the reopen signal store to call `startTour(lastStep)`.

**Staging is surface-based, not overlay-name-based.** Contacts and the base-map switcher do NOT live in the page-level `activeOverlay` set — they live inside `MapActionOverlay`'s internal `view` ref (the collapsed speed-dial). So the step descriptor carries an abstract `surface` (`'profile' | 'speed-dial-menu' | 'base-map-panel' | 'tour-bar'`) and `map-page`'s `stage()` maps each to the concrete calls: `openOverlay('profile')` for the profile sheet, and `mapOverlayRef.value.openMenu()` / `openBaseMap()` / `closeMenu()` (newly exposed) for the speed-dial surfaces. The composable never knows how a surface opens.

i18n: tour copy lives under a dedicated `onboarding.tour.*` namespace (steps, controls, reopen label), parallel to the new module and distinct from the existing `user.onboarding.*` profile-form keys.

### D3: Anchor targets via stable `data-tour="..."` attributes

Rather than coupling the tour to CSS classes (brittle), each highlighted control gets a `data-tour` attribute: `data-tour="contacts"`, `data-tour="tours"`, `data-tour="basemap"`, `data-tour="phone-verification"`, `data-tour="notifications"`. The step descriptor selects on these. Missing-target steps are skipped (spec requirement) to tolerate responsive differences.

**Phone-verification target is the `.phone-row` container, not a button.** The profile sheet renders one of three variants in that row depending on state — "Add phone" (no phone), "Verify" (unverified), or a verified check icon — so no single control is always present. Anchoring the always-rendered `.phone-row` keeps the step stable across all three states (important for replay), and the tooltip copy sells the *benefit* (add/verify your phone to be discoverable and connect with friends) rather than naming a specific button.

### D4: Staging surfaces between steps + driver.js interaction config

Each step names the **surface** it needs staged (see D2). The 8-step sequence and surfaces: phone-verification + notifications → `'profile'`; add-contact + your-contacts → `'contacts'` (contacts sheet); friend-requests → `'friend-requests'` (friend-requests sheet); my-tours tabs → `'tours'` (tours sheet); add-location → `'tour-bar'` (always-visible `TourActionBar`); switch-maps → `'base-map-panel'` (speed-dial base-map switcher). **Contacts, friend-requests and tours are page-level `activeOverlay` overlays**, so `stage()` opens the *real* sheet (`openOverlay(surface)`) and the tour highlights stable anchors that exist even for an empty new-user account (`.list-actions-row`/`.add-contact-btn`, a `.contacts-content` wrapper, `.tab-bar`, `.tabs`). Only the base-map switcher still needs the speed-dial (`MapActionOverlay.openBaseMap()`).

Because driver.js does NOT await its hooks, the composable controls progression manually with `driver.highlight()` per step: `goToStep(i)` awaits `stage(surface)` + a `waitForElement(selector)` poll, then highlights — or skips the step (in the travel direction) if the target never appears. Adjacent same-surface steps (e.g. the two profile steps) reuse the open sheet (`openOverlay` no-ops when already active); switching surfaces animates via the existing sheet `Transition mode="out-in"`, so step transitions are animated.

driver.js interaction config (resolved):

- `overlayClickBehavior: () => advance()` — tapping the dimmed backdrop **advances** (does not dismiss).
- `allowClose: false` — no backdrop-close, no Escape-to-dismiss.
- `disableActiveInteraction: true` — highlighted controls are inert during the tour.
- `showButtons: []` — **the popover has no footer buttons**. All controls live in the top banner (see D7); the popover is title + description only. This avoids cramming a long "Finish tour" label into driver.js's corner ✕ slot (which overflowed and collided with the title).

### D5: Two-field state persistence on the store

Persist two columns on `user_profile` (migration), mirrored in `userProfileSchema` + row schema and the `UserProfile` entity:

- `onboarding_tour_show_at_sign_in boolean not null default true` — auto-start gate. `default true` means every user (existing included) gets one auto-show; see Risks.
- `onboarding_tour_last_step integer not null default 0` — resume index.

`user-profile-store` exposes both fields plus two actions, both calling `updateProfile(...)` and logging+swallowing errors (non-blocking, spec):

- `dismissTourAtSignIn()` → `{ onboardingTourShowAtSignIn: false }`, called once when the tour is first auto-displayed at sign-in.
- `saveTourStep(n)` → `{ onboardingTourLastStep: n }`, called on close/finish (not per step — avoids chatty DB + realtime writes).

Reads: `store.profile?.onboardingTourShowAtSignIn` and `?.onboardingTourLastStep`. Piggybacks the existing `user_profile` realtime channel — no new subscription (reuse established realtime patterns).

### D6: Trigger guard + reopen + bidirectional nav

- **Auto-start:** `maybeStartTour()` runs only when authenticated, profile loaded, `onboardingTourShowAtSignIn === true`, and not already running (internal `isRunning` ref). On start it calls `dismissTourAtSignIn()` so it never auto-shows again. Gating on profile-loaded avoids a flash for users who already saw it. **Auto-starts regardless of profile completeness** — a user who skipped the profile form still gets feature discovery (it's non-blocking and skippable).
- **Reopen:** "Show app tour" in the profile sheet calls `onboardingTourStore.requestReopen()`; `map-page.vue` watches the store and calls `startTour(onboardingTourLastStep)` (bypasses the gate). Decouples the sibling overlay from the controller (D2).
- **Resume clamp:** `startTour` clamps the index to `[0, steps.length - 1]` so a persisted `last_step` that is out of range after a future step-list change never errors.
- **Bidirectional:** the composable tracks the active index and exposes `next`/`back`/`finish` actions; `goToStep(i, direction)` re-stages on either direction. Driven from the banner (D7), not driver.js footer buttons.
- **Persist on close/finish:** on dismiss (Finish tour) → `saveTourStep(currentIndex)`. On advancing past the final step → `saveTourStep(0)` so a later reopen replays from the start (resolved UX decision).

### D7: Top control banner (controls live outside the popover)

driver.js renders its dismiss as a corner ✕; relabelling it "Finish tour" overflowed the popover and collided with the title (observed on desktop + mobile). Resolution: **a custom `onboarding-tour-banner.vue` fixed at the top of the screen owns all controls** — a **Finish tour** button, a **step `X/Y`** progress indicator, and **back/forward arrow** buttons. The popover keeps only title + description (`showButtons: []`).

- The banner renders in `map-page.vue` (`v-if="tourRunning"`, slide/fade `Transition`) and is driven by the composable's exposed `isRunning` / `currentIndex` / `totalSteps`, wiring its events to `next` / `back` / `finish`.
- `z-index: 2147483000` sits above driver.js' overlay + popover (`z-index: 1000000000`) so the controls stay clickable and the backdrop-tap-advance never swallows banner clicks.
- Back arrow is disabled on step 0; forward arrow on the last step **completes** (resets resume to 0); Finish **dismisses** (saves current step). Tap-away still advances; highlighted control still inert.

## Risks / Trade-offs

- **Overlay timing races** (sheet animates in via `Transition mode="out-in"`; target not in DOM when driver.js measures) → composable awaits `nextTick` + a short `waitForElement(selector)` poll before advancing; skip step if it never appears.
- **driver.js z-index vs. sheet/FAB z-index** (sheets use `z-index: 50`, overlay is `pointer-events:none`) → verify the driver.js overlay/popover sit above sheets; set its z-index above 50 if needed via its `popoverClass`/CSS.
- **State write fails before navigation away** → acceptable; best-effort persisted. If `dismissTourAtSignIn()` fails, the tour may auto-show again next map mount (gate still true). If `saveTourStep` fails, resume falls back to the last persisted index. Logged, non-blocking (spec).
- **Coupling tour to `data-tour` attributes** → if a control is renamed/removed the step silently skips rather than breaking; trade discoverability of breakage for resilience. Mitigate with a brief comment at each anchor.
- **Migration default backfill** → `onboarding_tour_show_at_sign_in default true` means all existing users also get one auto-show on next visit. **Decided: intentional** — existing users may have missed features, so they get the one-time, skippable introduction too. No backfill UPDATE in the migration.

## Migration Plan

1. New migration `add_onboarding_tour_state.sql`: `alter table public.user_profile add column onboarding_tour_show_at_sign_in boolean not null default true, add column onboarding_tour_last_step integer not null default 0;` (grants/RLS already cover the table). No backfill UPDATE — existing users intentionally get the one-time auto-show too.
2. Apply locally via `supabase db reset`; verify schema + that `user-profile-store` reads the fields.
3. `npm run test`, `npm run type-check`, `npx eslint . --fix`.
4. `supabase db push` to prod is a separate, user-approved deploy step.

Rollback: columns are additive and defaulted; dropping them (or leaving them unused) is safe — no destructive change to existing data.

## Open Questions

- **Backfill existing users?** RESOLVED — no backfill. Existing users also get the auto-show once (`show_at_sign_in default true` applies to all rows).
- **Resume after full completion?** RESOLVED — reset `last_step` to 0 on finish so reopen replays from the start.
- **Replay entry point?** RESOLVED — "Show app tour" action in the profile sheet (in scope).
