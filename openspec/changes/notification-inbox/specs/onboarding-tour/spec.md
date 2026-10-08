# Spec Delta

## MODIFIED Requirements

### Requirement: Guided step sequence

The tour SHALL present steps in this order, each opening/driving the real surface and highlighting the corresponding feature with a spotlight and an explanatory popover: (1) plan a tour (the add-tour control in the bottom action bar), (2) switching maps (the base-map panel), (3) offline maps (the offline-maps entry in the speed-dial menu), (4) the notification inbox (the inbox entry in the speed-dial menu), (5) phone verification, (6) notification settings, (7) calendar sync (the calendar-sync row of the profile), (8) contacts (the add-contact control, covering the contacts list), (9) friend requests, (10) my tours (own/friends tabs), (11) open the calendar. Steps sharing a surface SHALL be adjacent, and moving between them SHALL NOT replay the navigation path. Steps whose surface is a page-level overlay (contacts, friend-requests, tours, profile) SHALL open the actual sheet and target a stable anchor that exists even for a new user with empty lists. The inbox step SHALL spotlight the inbox menu entry without opening the inbox. The final "open the calendar" step SHALL spotlight the calendar-open control in the My Tours sheet header (teaching the user where the calendar lives) without navigating away. When driving the app to a step's surface, the tour SHALL spotlight each intermediate navigation control it actuates (e.g. the menu FAB, a menu item) with a short hint label naming that control (e.g. "Open menu", "Open contacts"), starting from the surface already on screen when that surface lies on the path (e.g. an open speed-dial menu, an open contacts sheet).

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

#### Scenario: Inbox step points at the menu entry

- **WHEN** the tour advances from the offline-maps step to the notification inbox step
- **THEN** the speed-dial menu stays open and the inbox entry is spotlighted with a popover explaining that all updates collect there even with push and email off, and the inbox is not opened

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
