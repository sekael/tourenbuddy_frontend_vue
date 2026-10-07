## MODIFIED Requirements

### Requirement: Guided step sequence

The tour SHALL present steps in this order, each opening/driving the real surface and highlighting the corresponding feature with a spotlight and an explanatory popover: (1) plan a tour (the add-tour control in the bottom action bar), (2) switching maps (the base-map panel), (3) offline maps (the offline-maps entry in the speed-dial menu), (4) phone verification, (5) notification settings, (6) calendar sync (the calendar-sync row of the profile), (7) contacts (the add-contact control, covering the contacts list), (8) friend requests, (9) my tours (own/friends tabs), (10) open the calendar. Steps sharing a surface SHALL be adjacent, and moving between them SHALL NOT replay the navigation path. Steps whose surface is a page-level overlay (contacts, friend-requests, tours, profile) SHALL open the actual sheet and target a stable anchor that exists even for a new user with empty lists. The final "open the calendar" step SHALL spotlight the calendar-open control in the My Tours sheet header (teaching the user where the calendar lives) without navigating away. When driving the app to a step's surface, the tour SHALL spotlight each intermediate navigation control it actuates (e.g. the menu FAB, a menu item) with a short hint label naming that control (e.g. "Open menu", "Open contacts"), starting from the surface already on screen when that surface lies on the path (e.g. an open speed-dial menu, an open contacts sheet).

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

#### Scenario: Final step points at the calendar

- **WHEN** the tour reaches the "open the calendar" step
- **THEN** the My Tours sheet is open and the calendar-open control in its header is spotlighted with an explanatory popover, and the map page is NOT navigated away from by the spotlight itself

#### Scenario: Intermediate navigation controls are labelled

- **WHEN** reaching a step requires actuating intermediate controls (e.g. opening the menu FAB then a menu item)
- **THEN** each such control is spotlighted in turn with a short hint label naming it before the next surface opens

#### Scenario: Next step on the same surface

- **WHEN** the user advances from a step to one on the same surface (e.g. phone verification → notifications in the profile sheet)
- **THEN** the surface stays open, no intermediate controls are re-spotlighted, and the spotlight moves directly to the new target

#### Scenario: Path starts from the open surface

- **WHEN** the next step's path passes through the surface already on screen (e.g. contacts → friend requests, or the open speed-dial menu → a menu entry)
- **THEN** the tour continues from that surface instead of closing it and replaying the path from the map

#### Scenario: Target requires an overlay to be open

- **WHEN** a step targets an element that lives inside an overlay that is currently closed (e.g. the phone-verification or notification section inside the profile sheet)
- **THEN** the tour opens that overlay before highlighting the element, and closes/leaves it in a clean state when moving to a step in a different overlay

#### Scenario: Target element is missing

- **WHEN** a step's target element cannot be found in the DOM after its overlay is opened
- **THEN** the tour skips that step rather than highlighting an empty region or erroring

### Requirement: Control banner and non-blocking behavior

While the tour is active, the system SHALL display a control banner fixed at the top of the screen (above the spotlight overlay/popover) showing a "Finish tour" control, the current step's short title, a progress indicator (a progress line filled to `X / Y` and the text `X / Y`), and back/forward arrow controls, with the forward control visually emphasized as the primary action. When the step changes, the title SHALL cross-fade and the progress line SHALL animate to its new length. The tour's popover SHALL contain only the step title and description (no footer buttons). The tour SHALL be dismissible at any step via the banner's "Finish tour" control, and SHALL never force the user to complete an action (e.g. it must not require actually verifying a phone number to proceed). Tapping the dimmed backdrop SHALL advance to the next step rather than dismiss the tour. The highlighted control SHALL be inert (non-interactive) while the tour is active.

#### Scenario: Banner shows title, progress and navigation

- **WHEN** the tour is on step N of M
- **THEN** the banner shows the current step's short title, a progress line filled to N/M, and `N / M`; the back arrow is disabled on the first step, the forward arrow advances (and completes the tour past the last step), and the back arrow returns to the previous step

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

### Requirement: Stable spotlight popover placement

For each step the system SHALL position the popover so that it does not visibly jump after first appearing, does not overlap its own spotlight cutout, and is not clipped by the viewport edges on either mobile or desktop. The system SHALL move the spotlight onto the target before the popover appears and attach the popover only once the spotlight has arrived and the target's layout has settled. A step MAY declare a per-step popover side so a target sitting low in a tall surface does not overflow the screen bottom (where it would otherwise be flipped up into the top control banner). A spotlit target SHALL stay fully visible inside its cutout, including parts that extend beyond its parent element.

#### Scenario: Surface whose layout settles after opening

- **WHEN** a step targets a surface whose content changes after it opens (e.g. the profile overview's notification summary filling in once the notification preferences load)
- **THEN** the popover is positioned against the settled layout and does not jump to a corrected position after appearing

#### Scenario: Spotlight precedes the popover

- **WHEN** a step is staged and its target has settled
- **THEN** the spotlight cutout arrives on the target first and the popover is attached afterwards, against the final target rect

#### Scenario: Target sits low in a tall surface

- **WHEN** a step's target is near the bottom of a tall surface such that a below-target popover would overflow the viewport
- **THEN** the step's declared side keeps the popover within the viewport and clear of the top control banner

#### Scenario: Target overflows its parent

- **WHEN** a step spotlights the base-map options, which unfold outside the box of the menu entry that holds them
- **THEN** the options remain fully visible inside the spotlight cutout

## ADDED Requirements

### Requirement: Continuous tour motion

While a tour runs, the dimmed overlay SHALL stay up continuously from the first spotlight until the tour ends: moving between waypoints and steps SHALL glide the spotlight cutout from its current position to the next target rather than removing and re-raising the overlay. While the app switches surfaces, the cutout SHALL collapse in place and then grow onto the next control, never tracking an element that is being removed. A visible popover SHALL fade out before the spotlight moves, and each new popover SHALL fade in. Ending the tour by any path SHALL fade the overlay and popover out. The pre-tour welcome screen SHALL fade in and out. When the user prefers reduced motion, the spotlight SHALL jump without gliding and the fades SHALL be skipped. A tour started while a previous tour is still fading out SHALL NOT be affected by that fade-out.

#### Scenario: Advancing between two steps

- **WHEN** the user advances from one step to the next
- **THEN** the current popover fades out, the spotlight glides (or collapses and regrows across a surface change) onto the next target without the overlay disappearing, and the new popover fades in

#### Scenario: Waypoint before a surface opens

- **WHEN** the tour spotlights an intermediate control and then actuates it (e.g. a menu entry that opens a sheet)
- **THEN** the hint fades out and the spotlight holds still while the control is actuated, and it does not jump to the screen corner when the control disappears

#### Scenario: Finishing the tour

- **WHEN** the tour ends (finish, completion, navigation away)
- **THEN** the overlay and popover fade out instead of disappearing in a single frame

#### Scenario: Reduced motion

- **WHEN** the operating system requests reduced motion
- **THEN** the spotlight moves to each target without gliding and no fade animations run

#### Scenario: Tour restarted during the fade-out

- **WHEN** a tour (the same or the calendar tour after the hand-off) starts while the previous one is still fading out
- **THEN** the previous overlay is removed immediately and the new tour runs unaffected
