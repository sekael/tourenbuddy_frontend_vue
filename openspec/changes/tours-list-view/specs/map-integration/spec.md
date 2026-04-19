## ADDED Requirements

### Requirement: Map action overlay exposes a Tours FAB

`MapActionOverlay` SHALL render a floating action button labeled "Tours" using the Material Symbols `location_on` icon, positioned between the Contacts FAB (`group` icon) and the New Tour FAB (`add_location_alt` icon). The button SHALL emit an `open-tours` event when activated. The button SHALL be disabled while `mapStore.isPickingLocation` is `true` and SHALL be hidden under the same conditions the rest of the action overlay is hidden.

#### Scenario: Tours FAB is rendered between Contacts and New Tour

- **WHEN** `MapActionOverlay` is rendered with a signed-in user and `isPickingLocation === false`
- **THEN** the DOM order of the action FABs SHALL place the Tours FAB immediately after the Contacts FAB and immediately before the New Tour FAB

#### Scenario: Tours FAB emits open-tours

- **WHEN** the user activates the Tours FAB
- **THEN** `MapActionOverlay` SHALL emit an `open-tours` event with no payload

#### Scenario: Tours FAB hidden during location picking

- **WHEN** `mapStore.isPickingLocation` becomes `true`
- **THEN** the Tours FAB SHALL be hidden together with the rest of `MapActionOverlay`

### Requirement: Map page registers the tours overlay

`map-page.vue` SHALL extend its `OverlayName` union with `'tours'` and SHALL mount `TourListSheet` inside the same unified overlay container that hosts the other single-active overlays. Opening the tours overlay SHALL follow the existing single-active policy so that any other open overlay (contacts, profile, feedback, tour, tour-creation) closes when the tours overlay opens.

#### Scenario: Open tours overlay closes other overlays

- **WHEN** a different overlay is active and `MapActionOverlay` emits `open-tours`
- **THEN** `map-page.vue` SHALL set `activeOverlay` to `'tours'`, causing the previously active overlay to unmount
- **AND** `TourListSheet` SHALL mount

#### Scenario: Tour list close resets overlay state

- **WHEN** `TourListSheet` emits `close`
- **THEN** `map-page.vue` SHALL reset `activeOverlay` so no overlay is active

#### Scenario: Selecting a tour from the list hands off to TourInfoSheet

- **WHEN** the user taps a tour row inside `TourListSheet`
- **THEN** `mapStore.selectTour(tourId)` SHALL be called and `TourListSheet` SHALL emit `close`
- **AND** the existing map-page reaction to `selectedTourId` SHALL open `TourInfoSheet` and fly the camera to the tour's goal
