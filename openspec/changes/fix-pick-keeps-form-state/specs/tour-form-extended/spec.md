# Spec Delta

## MODIFIED Requirements

### Requirement: Pick-type label in collapsed overlay header

While the location picker is active, the surrounding tour creation dialog and tour info sheet collapse to a header-only surface (a bottom title bar on mobile, side-drawer compact header on desktop). That collapsed header SHALL display a label naming the location type currently being picked, so the user retains context once the form is hidden.

The label SHALL resolve from the active pick type:

- `goal` → "Tour Goal" / "Tourenziel"
- `start` → "Start Point" / "Startpunkt"
- `end` → "End Point" / "Endpunkt"

The `location-picker.vue` component itself SHALL NOT render an additional title bar over the map canvas.

#### Scenario: Goal pick on mobile

- **WHEN** the user is on a mobile viewport and enters location-pick mode with pick type `goal`
- **THEN** the overlay SHALL be collapsed to a bottom title bar and the title SHALL read "Tour Goal" (or its localized equivalent)

#### Scenario: Start pick on desktop

- **WHEN** the user is on a desktop viewport and enters location-pick mode with pick type `start`
- **THEN** the side drawer SHALL be in its collapsed top-right header state and the title SHALL read "Start Point" (or its localized equivalent)

#### Scenario: End pick label

- **WHEN** the user enters location-pick mode with pick type `end` on either viewport
- **THEN** the collapsed overlay header SHALL read "End Point" (or its localized equivalent)

#### Scenario: No standalone title bar on map canvas

- **WHEN** location-pick mode is active for any pick type
- **THEN** `location-picker.vue` SHALL NOT render a title bar over the map; the only label SHALL be the one in the collapsed overlay header

## ADDED Requirements

### Requirement: Location pick preserves unsaved form edits

Starting, confirming or cancelling a location pick (goal, start or end) from the tour create, edit or suggest form SHALL NOT discard any value the user has entered but not yet saved. After the pick, every field SHALL show the value it had before the pick, except the field the pick itself sets. This SHALL hold on both mobile and desktop viewports.

#### Scenario: Start pick during creation keeps partners and activity type

- **WHEN** the user creates a tour on a mobile viewport, selects partners and an activity type, then picks and confirms a start point
- **THEN** the form SHALL show the selected partners and activity type unchanged
- **AND** the start point SHALL be set to the picked location

#### Scenario: Cancelled pick keeps edits

- **WHEN** the user edits any form field, starts a location pick and cancels it
- **THEN** the form SHALL show every edited field unchanged

#### Scenario: Pick during tour edit keeps edits

- **WHEN** the user edits an existing tour on a mobile viewport, changes the notes, then picks and confirms an end point
- **THEN** the changed notes SHALL still be in the form
