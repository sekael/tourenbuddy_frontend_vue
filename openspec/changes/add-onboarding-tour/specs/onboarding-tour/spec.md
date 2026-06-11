## ADDED Requirements

### Requirement: First-arrival welcome trigger

The system SHALL present the pre-tour welcome screen (not the spotlight tour itself) the first time an authenticated user arrives at the map after their profile onboarding has completed or been skipped, gated on `onboarding_tour_show_at_sign_in = true`. Presenting the welcome screen SHALL NOT by itself change `onboarding_tour_show_at_sign_in`; the gate flag is only updated by the welcome actions (see "Pre-tour welcome screen").

#### Scenario: New user reaches map for the first time

- **WHEN** an authenticated user with `onboarding_tour_show_at_sign_in = true` arrives at the `/map` route and the profile/map data has loaded
- **THEN** the welcome screen is shown, the spotlight tour does NOT start yet, and `onboarding_tour_show_at_sign_in` is left unchanged until the user picks a welcome action

#### Scenario: Returning user who already saw the tour at sign-in

- **WHEN** an authenticated user with `onboarding_tour_show_at_sign_in = false` arrives at the map
- **THEN** the welcome screen does NOT appear (the tour remains reopenable from the profile sheet)

#### Scenario: Profile not yet loaded

- **WHEN** the map mounts but the user profile has not finished loading
- **THEN** the welcome screen does NOT appear until the profile (and thus the gate flag) is known, avoiding a flash for users who already saw it

#### Scenario: User skipped the profile form

- **WHEN** a user skipped the profile onboarding form (name/phone unset) and arrives at the map with `onboarding_tour_show_at_sign_in = true`
- **THEN** the welcome screen still appears — feature discovery does not depend on profile completeness

### Requirement: Pre-tour welcome screen

When the tour is triggered at sign-in, the system SHALL present a welcome screen introducing the app — rendered as a full-screen page on mobile and as a centered dialog over a dimmed backdrop on larger screens — offering three actions: start the tour, skip for now, and don't show again. The welcome screen SHALL appear only on the sign-in auto-trigger; reopening the tour from the profile sheet SHALL bypass it. The welcome screen SHALL NOT be dismissible except via one of the three actions.

#### Scenario: User starts the tour from the welcome screen

- **WHEN** the user activates "Start tour" on the welcome screen
- **THEN** the welcome screen closes, `onboarding_tour_show_at_sign_in` is persisted as `false`, and the spotlight tour starts at step `onboarding_tour_last_step`

#### Scenario: User skips for now

- **WHEN** the user activates "Skip for now" on the welcome screen
- **THEN** the welcome screen closes, the tour does NOT start, and `onboarding_tour_show_at_sign_in` is left unchanged so the welcome screen appears again at the next sign-in

#### Scenario: User chooses don't show again

- **WHEN** the user activates "Don't show again" on the welcome screen
- **THEN** the welcome screen closes, the tour does NOT start, and `onboarding_tour_show_at_sign_in` is persisted as `false` so it never auto-appears again

#### Scenario: Reopen bypasses the welcome screen

- **WHEN** the user activates "Show app tour" from the profile sheet
- **THEN** the spotlight tour starts directly at `onboarding_tour_last_step` without showing the welcome screen

### Requirement: Reopen from profile sheet

The system SHALL provide a "Show app tour" action in the user profile sheet that starts the tour regardless of `onboarding_tour_show_at_sign_in`, resuming at `onboarding_tour_last_step`.

#### Scenario: User reopens after closing mid-tour

- **WHEN** the user closed the tour at step N and later activates "Show app tour"
- **THEN** the tour starts at step N

#### Scenario: User reopens after finishing the whole tour

- **WHEN** the user previously advanced past the final step (so `onboarding_tour_last_step` was reset to 0) and activates "Show app tour"
- **THEN** the tour starts again at the first step

### Requirement: Bidirectional step navigation and resume persistence

The tour SHALL allow navigating steps both forward and backward. The system SHALL persist the current step index to `onboarding_tour_last_step` on close/finish so a later reopen resumes there. On finishing the final step, the system SHALL reset `onboarding_tour_last_step` to `0`.

#### Scenario: Navigating backward

- **WHEN** the user is on step N (N > 0) and activates the back control
- **THEN** the tour returns to step N-1, re-staging that step's overlay/target

#### Scenario: Closing mid-tour persists the step

- **WHEN** the user closes or skips the tour while on step N (not the final step)
- **THEN** `onboarding_tour_last_step` is persisted as N

#### Scenario: Finishing resets resume point

- **WHEN** the user advances past the final step
- **THEN** the tour ends and `onboarding_tour_last_step` is persisted as 0

#### Scenario: Out-of-range resume index

- **WHEN** the persisted `onboarding_tour_last_step` is greater than the last available step index (e.g. after a future step-list change)
- **THEN** the tour clamps the start index into the valid range rather than erroring

### Requirement: Guided step sequence

The tour SHALL present steps in this order, each opening/driving the real surface and highlighting the corresponding feature with a spotlight and an explanatory popover: (1) phone verification, (2) notification settings, (3) add a contact, (4) your contacts list, (5) friend requests, (6) my tours (own/friends tabs), (7) add a location, (8) switching maps. Steps whose surface is a page-level overlay (contacts, friend-requests, tours) SHALL open the actual sheet and target a stable anchor that exists even for a new user with empty lists. When driving the app to a step's surface, the tour SHALL spotlight each intermediate navigation control it actuates (e.g. the menu FAB, a menu item) with a short hint label naming that control (e.g. "Open menu", "Open contacts").

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

#### Scenario: Intermediate navigation controls are labelled

- **WHEN** reaching a step requires actuating intermediate controls (e.g. opening the menu FAB then a menu item)
- **THEN** each such control is spotlighted in turn with a short hint label naming it before the next surface opens

#### Scenario: Target requires an overlay to be open

- **WHEN** a step targets an element that lives inside an overlay that is currently closed (e.g. the phone-verification or notification section inside the profile sheet)
- **THEN** the tour opens that overlay before highlighting the element, and closes/leaves it in a clean state when moving to a step in a different overlay

#### Scenario: Target element is missing

- **WHEN** a step's target element cannot be found in the DOM after its overlay is opened
- **THEN** the tour skips that step rather than highlighting an empty region or erroring

### Requirement: Control banner and non-blocking behavior

While the tour is active, the system SHALL display a control banner fixed at the top of the screen (above the spotlight overlay/popover) showing a "Finish tour" control, the current step's short title, the current step position as `X / Y`, and back/forward arrow controls. The tour's popover SHALL contain only the step title and description (no footer buttons). The tour SHALL be dismissible at any step via the banner's "Finish tour" control, and SHALL never force the user to complete an action (e.g. it must not require actually verifying a phone number to proceed). Tapping the dimmed backdrop SHALL advance to the next step rather than dismiss the tour. The highlighted control SHALL be inert (non-interactive) while the tour is active.

#### Scenario: Banner shows title, progress and navigation

- **WHEN** the tour is on step N of M
- **THEN** the banner shows the current step's short title and `N / M`, the back arrow is disabled on the first step, the forward arrow advances (and completes the tour past the last step), and the back arrow returns to the previous step

#### Scenario: User finishes the tour mid-sequence

- **WHEN** the user clicks the "Finish tour" control during any step
- **THEN** the tour ends immediately, the current step is persisted to `onboarding_tour_last_step`, and it does not auto-start again at sign-in (it remains reopenable from the profile sheet)

#### Scenario: User taps the backdrop

- **WHEN** the user taps the dimmed overlay outside the highlighted target
- **THEN** the tour advances to the next step (it does NOT dismiss); tapping past the final step finishes the tour

#### Scenario: Backdrop tap and Escape do not dismiss

- **WHEN** the user taps the backdrop or presses Escape
- **THEN** the tour is NOT dismissed; only the "Finish tour" control ends it

#### Scenario: Highlighted control is not operable

- **WHEN** the tour is active and a control (e.g. "Add phone") is highlighted
- **THEN** the user cannot activate that control through the overlay; it is explained, not operated

### Requirement: Cross-device state persistence

The system SHALL persist tour state in the `onboarding_tour_show_at_sign_in` and `onboarding_tour_last_step` columns on `user_profile` so the auto-show gate and resume point follow the user across devices and sessions.

#### Scenario: State persisted via the profile store

- **WHEN** the user starts the tour or chooses "don't show again" on the welcome screen, or the tour ends (finished/skipped)
- **THEN** the system persists the updated `onboarding_tour_show_at_sign_in` and/or `onboarding_tour_last_step` for the user via the profile store

#### Scenario: Persistence failure does not break the app

- **WHEN** persisting tour state fails (network/DB error)
- **THEN** the tour still opens/closes for the current session and the error is logged via the logger composable without surfacing a blocking error to the user

#### Scenario: Synced across devices

- **WHEN** the state is updated on one device
- **THEN** the existing `user_profile` realtime subscription propagates the change so other open sessions reflect it

### Requirement: Localized tour copy

All tour titles and descriptions SHALL be provided through `vue-i18n` keys with values for every supported locale.

#### Scenario: Locale coverage

- **WHEN** a new tour string is introduced
- **THEN** a corresponding key exists in both `en.json` and `de-CH.json` and the tour renders the active locale's text

### Requirement: Stable spotlight popover placement

For each step the system SHALL position the popover so that it does not visibly jump after first appearing, does not overlap its own spotlight cutout, and is not clipped by the viewport edges on either mobile or desktop. The system SHALL reveal the spotlight before the popover and position the popover only once the target's layout has settled. A step MAY declare a per-step popover side so a target sitting low in a tall surface does not overflow the screen bottom (where it would otherwise be flipped up into the top control banner).

#### Scenario: Surface whose layout settles after opening

- **WHEN** a step targets a surface whose height changes after it opens (e.g. the profile dialog growing once the notification preferences load, re-centering a vertically centered dialog)
- **THEN** the popover is positioned against the settled layout and does not jump to a corrected position after appearing

#### Scenario: Spotlight precedes the popover

- **WHEN** a step is staged and its target has settled
- **THEN** the spotlight cutout is shown first and the popover is attached afterwards, against the final target rect

#### Scenario: Target sits low in a tall surface

- **WHEN** a step's target is near the bottom of a tall surface such that a below-target popover would overflow the viewport
- **THEN** the step's declared side keeps the popover within the viewport and clear of the top control banner
