# Spec Delta

## REMOVED Requirements

### Requirement: Guided step sequence

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "Guided step order", "Guided step targets", "Steps sharing a surface stay adjacent", "Overlay steps open the real sheet", "Inbox step spotlights the menu entry", "Final step spotlights the calendar control", "Intermediate navigation controls are spotlighted".

## ADDED Requirements

### Requirement: Guided step order

The tour SHALL present steps in this order, each opening/driving the real surface and highlighting the corresponding feature with a spotlight and an explanatory popover: (1) plan a tour, (2) map layers, (3) offline maps, (4) the notification inbox, (5) phone verification, (6) notification settings, (7) calendar sync, (8) contacts, (9) friend requests, (10) my tours, (11) open the calendar. Each step SHALL target the feature named in "Guided step targets".

#### Scenario: Advancing through all steps

- **WHEN** the user advances past the final step
- **THEN** the tour ends and is marked completed

### Requirement: Guided step targets

The guided steps SHALL target: plan a tour — the add-tour control in the bottom action bar; map layers — the map layers panel, covering base-map choice and trail overlays; offline maps — the offline-maps entry in the speed-dial menu; the notification inbox — the inbox entry in the speed-dial menu; calendar sync — the calendar-sync row of the profile; contacts — the add-contact control, covering the contacts list; my tours — own/friends tabs.

#### Scenario: Map layers step

- **WHEN** the tour reaches the map layers step
- **THEN** the speed-dial menu is open, the "Map layers" entry is spotlighted with its hint label, the layers panel unfolds, and the spotlight covers the whole panel with a popover explaining base maps and trail overlays and that ski routes can be tapped for details, without changing the user's base map or overlays

### Requirement: Steps sharing a surface stay adjacent

Steps sharing a surface SHALL be adjacent, and moving between them SHALL NOT replay the navigation path.

#### Scenario: Next step on the same surface

- **WHEN** the user advances from a step to one on the same surface (e.g. phone verification → notifications in the profile sheet)
- **THEN** the surface stays open, no intermediate controls are re-spotlighted, and the spotlight moves directly to the new target

### Requirement: Overlay steps open the real sheet

Steps whose surface is a page-level overlay (contacts, friend-requests, tours, profile) SHALL open the actual sheet and target a stable anchor that exists even for a new user with empty lists.

#### Scenario: Target requires an overlay to be open

- **WHEN** a step targets an element that lives inside an overlay that is currently closed (e.g. the phone-verification or notification section inside the profile sheet)
- **THEN** the tour opens that overlay before highlighting the element, and closes/leaves it in a clean state when moving to a step in a different overlay

#### Scenario: Target element is missing

- **WHEN** a step's target element cannot be found in the DOM after its overlay is opened
- **THEN** the tour skips that step rather than highlighting an empty region or erroring

### Requirement: Inbox step spotlights the menu entry

The inbox step SHALL spotlight the inbox menu entry without opening the inbox.

#### Scenario: Inbox step points at the menu entry

- **WHEN** the tour advances from the offline-maps step to the notification inbox step
- **THEN** the speed-dial menu stays open and the inbox entry is spotlighted with a popover explaining that all updates collect there even with push and email off, and the inbox is not opened

### Requirement: Final step spotlights the calendar control

The final "open the calendar" step SHALL spotlight the calendar-open control in the My Tours sheet header (teaching the user where the calendar lives) without navigating away.

#### Scenario: Final step points at the calendar

- **WHEN** the tour reaches the "open the calendar" step
- **THEN** the My Tours sheet is open and the calendar-open control in its header is spotlighted with an explanatory popover, and the map page is NOT navigated away from by the spotlight itself

### Requirement: Intermediate navigation controls are spotlighted

When driving the app to a step's surface, the tour SHALL spotlight each intermediate navigation control it actuates (e.g. the menu FAB, a menu item) with a short hint label naming that control (e.g. "Open menu", "Open contacts"), starting from the surface already on screen when that surface lies on the path (e.g. an open speed-dial menu, an open contacts sheet).

#### Scenario: Intermediate navigation controls are labelled

- **WHEN** reaching a step requires actuating intermediate controls (e.g. opening the menu FAB then a menu item)
- **THEN** each such control is spotlighted in turn with a short hint label naming it before the next surface opens

#### Scenario: Path starts from the open surface

- **WHEN** the next step's path passes through the surface already on screen (e.g. contacts → friend requests, or the open speed-dial menu → a menu entry)
- **THEN** the tour continues from that surface instead of closing it and replaying the path from the map
