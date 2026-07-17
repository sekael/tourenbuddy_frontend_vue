## MODIFIED Requirements

### Requirement: Guided step sequence

The tour SHALL present steps in this order, each opening/driving the real surface and highlighting the corresponding feature with a spotlight and an explanatory popover: (1) phone verification, (2) notification settings, (3) add a contact, (4) your contacts list, (5) friend requests, (6) my tours (own/friends tabs), (7) add a location, (8) switching maps, (9) open the calendar. Steps whose surface is a page-level overlay (contacts, friend-requests, tours) SHALL open the actual sheet and target a stable anchor that exists even for a new user with empty lists. The final "open the calendar" step SHALL spotlight the calendar-open control in the My Tours sheet header (teaching the user where the calendar lives) without navigating away. When driving the app to a step's surface, the tour SHALL spotlight each intermediate navigation control it actuates (e.g. the menu FAB, a menu item) with a short hint label naming that control (e.g. "Open menu", "Open contacts").

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

#### Scenario: Final step points at the calendar

- **WHEN** the tour reaches the "open the calendar" step
- **THEN** the My Tours sheet is open and the calendar-open control in its header is spotlighted with an explanatory popover, and the map page is NOT navigated away from by the spotlight itself

#### Scenario: Intermediate navigation controls are labelled

- **WHEN** reaching a step requires actuating intermediate controls (e.g. opening the menu FAB then a menu item)
- **THEN** each such control is spotlighted in turn with a short hint label naming it before the next surface opens

#### Scenario: Target requires an overlay to be open

- **WHEN** a step targets an element that lives inside an overlay that is currently closed (e.g. the phone-verification or notification section inside the profile sheet)
- **THEN** the tour opens that overlay before highlighting the element, and closes/leaves it in a clean state when moving to a step in a different overlay

#### Scenario: Target element is missing

- **WHEN** a step's target element cannot be found in the DOM after its overlay is opened
- **THEN** the tour skips that step rather than highlighting an empty region or erroring

## ADDED Requirements

### Requirement: Hand-off to the calendar route on completion

When the onboarding (map) tour is completed by advancing past its final step, the system SHALL set a one-shot "start calendar tour" hand-off intent and navigate to the calendar route. Whether the calendar tour then actually starts is decided by the calendar tour's own gate (see the `calendar-tour` capability): it starts on a fresh gate and is suppressed once the gate is spent. This hand-off SHALL apply on both the first-run completion and the profile-sheet "Show app tour" reopen (which replays the map tour to completion). Dismissing the tour early via "Finish tour" SHALL NOT set the hand-off intent.

#### Scenario: Completing the map tour navigates to the calendar with the hand-off intent

- **WHEN** the user advances past the final map-tour step
- **THEN** the map tour ends, a one-shot "start calendar tour" intent is set, and the app navigates to the calendar route

#### Scenario: Reopened map tour completion also hands off

- **WHEN** the user reopens the tour via "Show app tour", replays it to the end, and advances past the final step
- **THEN** the same hand-off intent is set and the app navigates to the calendar route

#### Scenario: Early dismissal does not hand off

- **WHEN** the user ends the map tour early via "Finish tour" before the final step
- **THEN** no hand-off intent is set and the app is NOT navigated to the calendar
