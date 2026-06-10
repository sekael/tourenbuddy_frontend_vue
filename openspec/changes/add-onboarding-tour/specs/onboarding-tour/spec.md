## ADDED Requirements

### Requirement: First-arrival tour trigger

The system SHALL auto-start the guided onboarding tour the first time an authenticated user arrives at the map after their profile onboarding has completed or been skipped, gated on `onboarding_tour_show_at_sign_in = true`. Once the tour is first displayed at sign-in, the system SHALL set `onboarding_tour_show_at_sign_in = false` so it never auto-starts again.

#### Scenario: New user reaches map for the first time

- **WHEN** an authenticated user with `onboarding_tour_show_at_sign_in = true` arrives at the `/map` route and the profile/map data has loaded
- **THEN** the guided tour auto-starts at step `onboarding_tour_last_step` (0 for a new user) and `onboarding_tour_show_at_sign_in` is persisted as `false`

#### Scenario: Returning user who already saw the tour at sign-in

- **WHEN** an authenticated user with `onboarding_tour_show_at_sign_in = false` arrives at the map
- **THEN** the tour does NOT auto-start (it remains reopenable from the profile sheet)

#### Scenario: Profile not yet loaded

- **WHEN** the map mounts but the user profile has not finished loading
- **THEN** the tour does NOT auto-start until the profile (and thus the gate flag) is known, avoiding a flash of the tour for users who already saw it

#### Scenario: User skipped the profile form

- **WHEN** a user skipped the profile onboarding form (name/phone unset) and arrives at the map with `onboarding_tour_show_at_sign_in = true`
- **THEN** the tour still auto-starts — feature discovery does not depend on profile completeness

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

The tour SHALL present steps in this order, each highlighting the corresponding feature with a spotlight and an explanatory tooltip: (1) phone verification, (2) notification settings, (3) contacts, (4) tours, (5) switching maps.

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

#### Scenario: Target requires an overlay to be open

- **WHEN** a step targets an element that lives inside an overlay that is currently closed (e.g. the phone-verification or notification section inside the profile sheet)
- **THEN** the tour opens that overlay before highlighting the element, and closes/leaves it in a clean state when moving to a step in a different overlay

#### Scenario: Target element is missing

- **WHEN** a step's target element cannot be found in the DOM after its overlay is opened
- **THEN** the tour skips that step rather than highlighting an empty region or erroring

### Requirement: Dismiss control and non-blocking behavior

The tour SHALL be dismissible at any step via an explicit "Finish tour" control present on every step, and SHALL never force the user to complete an action (e.g. it must not require actually verifying a phone number to proceed). Tapping the dimmed backdrop SHALL advance to the next step rather than dismiss the tour. The highlighted control SHALL be inert (non-interactive) while the tour is active.

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

- **WHEN** the tour is first displayed at sign-in, or it ends (finished/skipped)
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
