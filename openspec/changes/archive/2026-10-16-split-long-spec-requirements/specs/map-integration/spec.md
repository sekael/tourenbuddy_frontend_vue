# Spec Delta

## REMOVED Requirements

### Requirement: Map action overlay with FABs

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "Speed-dial entries and order", "Speed dial excludes Tours and Add tour", "Speed-dial trigger disabled while an overlay is active".

## ADDED Requirements

### Requirement: Speed-dial entries and order

The map page SHALL display entries in the bottom-right speed dial, in this order: feedback, base map style picker, offline maps, user profile, contacts, and the notification inbox (nearest the trigger, carrying the inbox badge — see `notification-inbox`). Profile shows a dot when an app update is available; contacts shows a dot while incoming friend requests are pending.

#### Scenario: Style picker button

- **WHEN** the user clicks the style picker entry in the speed-dial menu
- **THEN** the menu SHALL stay open with its other entries dimmed and inert
- **AND** the available map styles SHALL unfold beside the style picker entry, the active one checked
- **AND** choosing a style, or tapping anywhere outside the styles, SHALL close the whole menu

#### Scenario: User profile button

- **WHEN** the user clicks the profile entry in the speed-dial menu
- **THEN** the user profile sheet SHALL open

#### Scenario: Contacts button

- **WHEN** the user clicks the contacts entry in the speed-dial menu
- **THEN** the contacts list sheet SHALL open

### Requirement: Speed dial excludes Tours and Add tour

The previously top-level Tours and Add-tour FABs SHALL NOT be part of the speed dial — they are owned by the persistent bottom-center tour action bar.

#### Scenario: Speed-dial does not expose Tours or Add tour

- **WHEN** the user opens the speed-dial menu
- **THEN** the menu SHALL NOT contain a Tours entry or an Add-tour entry

### Requirement: Speed-dial trigger disabled while an overlay is active

The speed-dial trigger SHALL be disabled while any overlay is active (`activeOverlay !== null`).

#### Scenario: Speed-dial trigger hidden during location picking

- **WHEN** `mapStore.isPickingLocation === true`
- **THEN** the speed-dial trigger and its menu SHALL be hidden (existing behaviour)

#### Scenario: Speed-dial trigger disabled when an overlay is open

- **WHEN** any overlay is active (`activeOverlay !== null`) and `mapStore.isPickingLocation === false`
- **THEN** the speed-dial trigger SHALL render in a disabled state
- **AND** clicking it SHALL NOT open the menu
