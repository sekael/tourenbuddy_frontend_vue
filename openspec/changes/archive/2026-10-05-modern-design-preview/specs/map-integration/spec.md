## MODIFIED Requirements

### Requirement: Map action overlay with FABs

The map page SHALL display entries in the bottom-right speed dial for: feedback, base map style picker, offline maps, user profile, and contacts. The previously top-level Tours and Add-tour FABs SHALL NOT be part of the speed dial — they are owned by the persistent bottom-center tour action bar. The speed-dial trigger SHALL be disabled while any overlay is active (`activeOverlay !== null`).

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

#### Scenario: Speed-dial does not expose Tours or Add tour

- **WHEN** the user opens the speed-dial menu
- **THEN** the menu SHALL NOT contain a Tours entry or an Add-tour entry

#### Scenario: Speed-dial trigger hidden during location picking

- **WHEN** `mapStore.isPickingLocation === true`
- **THEN** the speed-dial trigger and its menu SHALL be hidden (existing behaviour)

#### Scenario: Speed-dial trigger disabled when an overlay is open

- **WHEN** any overlay is active (`activeOverlay !== null`) and `mapStore.isPickingLocation === false`
- **THEN** the speed-dial trigger SHALL render in a disabled state
- **AND** clicking it SHALL NOT open the menu

### Requirement: Map action overlay icons

Each speed-dial entry SHALL show its label followed by a Material Symbols icon: `feedback` for feedback, `map` for the base map picker, `download_for_offline` for offline maps, `account_circle` for profile, and `group` for contacts. Every entry, the trigger, and the compass SHALL wear the shared map-control glass surface (semi-transparent brand fill with backdrop blur) for visual separation from map content.

#### Scenario: FABs display Material Symbols

- **WHEN** the speed-dial menu is open in portrait
- **THEN** each entry shows its label followed by its Material Symbol icon, the icons aligned on the trigger's axis

#### Scenario: FABs have glass effect

- **WHEN** the map action overlay is visible over map content
- **THEN** entry backgrounds are semi-transparent with a blur effect

### Requirement: Base map picker styling

The base map options SHALL render as the same glass pills as the speed-dial entries (label, then icon). The active style SHALL show a check icon and the stronger glass fill; the others show the `map` icon.

#### Scenario: Map picker dropdown renders with glass effect

- **WHEN** the user opens the base map options
- **THEN** each option is a glass pill with white label and icon over a semi-transparent blurred background, and exactly the active style is checked

### Requirement: Location picker button styling

The location picker and the offline-region drawing SHALL use the shared `Button` for their actions: Cancel (and Redraw) as the tonal secondary variant lifted off the map with `--shadow-md`, Continue as the primary variant, all with pill corners.

#### Scenario: Location picker buttons render with updated styling

- **WHEN** the location picker is active
- **THEN** Cancel renders as a tonal secondary pill with a shadow and Continue as a primary pill

## REMOVED Requirements

### Requirement: Round action button size and style

**Reason**: The `round-action-button` component was unused and has been deleted; map controls are the speed-dial trigger, its entries, and the compass, which wear the shared glass surface at 52px (trigger, compass) and 48px (entries).
**Migration**: None — no consumer remained.
