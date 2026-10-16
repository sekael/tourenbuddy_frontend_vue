# Spec Delta

## MODIFIED Requirements

### Requirement: Map action overlay icons

Each speed-dial entry SHALL show its label followed by a Material Symbols icon: `feedback` for feedback, `layers` for map layers, `download_for_offline` for offline maps, `account_circle` for profile, `group` for contacts, and `notifications` for the inbox. Every entry, the trigger, and the compass SHALL wear the shared map-control glass surface (semi-transparent brand fill with backdrop blur) for visual separation from map content.

#### Scenario: FABs display Material Symbols

- **WHEN** the speed-dial menu is open in portrait
- **THEN** each entry shows its label followed by its Material Symbol icon, the icons aligned on the trigger's axis

#### Scenario: FABs have glass effect

- **WHEN** the map action overlay is visible over map content
- **THEN** entry backgrounds are semi-transparent with a blur effect

### Requirement: Speed-dial trigger disabled while an overlay is active

While any overlay is active (`activeOverlay !== null`), the speed-dial trigger SHALL render in a disabled state, and tapping it SHALL close the active overlay instead of opening the menu, as "Single active top-level interaction" in `tour-action-bar` specifies.

#### Scenario: Speed-dial trigger hidden during location picking

- **WHEN** `mapStore.isPickingLocation === true`
- **THEN** the speed-dial trigger and its menu SHALL be hidden (existing behaviour)

#### Scenario: Speed-dial trigger hidden while drawing an offline region

- **WHEN** the user is drawing a region to download as an offline map
- **THEN** the speed-dial trigger and its menu SHALL be hidden

#### Scenario: Speed-dial trigger disabled when an overlay is open

- **WHEN** any overlay is active (`activeOverlay !== null`) and `mapStore.isPickingLocation === false`
- **THEN** the speed-dial trigger SHALL render in a disabled state
- **AND** tapping it SHALL close the active overlay without opening the menu

## REMOVED Requirements

### Requirement: Speed-dial entries and order

**Reason**: Lists a base-map style picker and a "Style picker button" scenario (styles unfolding beside the entry); the app replaced that picker with the map layers panel. A MODIFIED block cannot drop a scenario, so the requirement is replaced.
**Migration**: Now covered by "Speed-dial menu entries and order"; the panel itself by "Map layers panel" in `map-trail-overlays`.

### Requirement: Base map picker styling

**Reason**: Describes base-map options as glass pills with a check or `map` icon; the map layers panel replaced them with preview tiles.
**Migration**: Covered by "Map layers panel" in `map-trail-overlays` (preview image and name, accent outline and check badge on the chosen option).

## ADDED Requirements

### Requirement: Speed-dial menu entries and order

The map page SHALL display entries in the bottom-right speed dial, in this order: feedback, map layers, offline maps, user profile, contacts, and the notification inbox (nearest the trigger, carrying the inbox badge — see `notification-inbox`). Profile shows a dot when an app update is available; contacts shows a dot while incoming friend requests are pending.

#### Scenario: Map layers entry

- **WHEN** the user clicks the "Map layers" entry in the speed-dial menu
- **THEN** the map layers panel SHALL replace the menu above the trigger (see "Map layers panel" in `map-trail-overlays`)

#### Scenario: User profile button

- **WHEN** the user clicks the profile entry in the speed-dial menu
- **THEN** the user profile sheet SHALL open

#### Scenario: Contacts button

- **WHEN** the user clicks the contacts entry in the speed-dial menu
- **THEN** the contacts list sheet SHALL open
