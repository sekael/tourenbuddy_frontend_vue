## ADDED Requirements

### Requirement: MapLibre GL JS map with Swisstopo tiles

The app SHALL render a full-screen MapLibre GL JS map on the `/map` page using Swisstopo vector tiles. The initial view SHALL center on Switzerland (46.8°N, 8.2°E) at zoom level 8.

#### Scenario: Map loads with base style

- **WHEN** the map page is rendered
- **THEN** a MapLibre map SHALL initialize with the Swisstopo base vector tile style from `https://vectortiles.geo.admin.ch`

#### Scenario: Map cleanup on unmount

- **WHEN** the map page is navigated away from
- **THEN** the MapLibre map instance SHALL be destroyed to free resources

### Requirement: Map style switching

The map SHALL support switching between two Swisstopo styles: "Base" (vector tiles) and "Full Color" (WMTS raster style loaded from a local JSON file).

#### Scenario: Switch to full color style

- **WHEN** the user selects "Full Color" from the style picker
- **THEN** the map SHALL load the WMTS style from `public/swisstopo_wmts_style.json` and re-render

#### Scenario: Switch back to base style

- **WHEN** the user selects "Base" from the style picker
- **THEN** the map SHALL revert to the vector tile style URL

### Requirement: Tour markers rendered as circles

Tours SHALL be rendered on the map as circle markers using a MapLibre circle layer backed by a GeoJSON source.

#### Scenario: Tours displayed on map

- **WHEN** the tours store has loaded tours
- **THEN** each tour SHALL appear as a circle marker at its goal coordinates

#### Scenario: Selected tour highlighted

- **WHEN** a user clicks on a tour circle
- **THEN** the selected tour SHALL render with a larger radius (18px vs default 14px) and a white stroke

#### Scenario: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

### Requirement: Location picker with crosshair

The map SHALL support a location-picking mode where a crosshair overlay appears at the center of the viewport, and the user can pan to choose a location.

#### Scenario: Enter location picker mode

- **WHEN** the user clicks the "Add Location" button
- **THEN** a crosshair overlay SHALL appear at the center of the map, the map action buttons SHALL hide, and cancel/continue FABs SHALL appear

#### Scenario: Confirm location

- **WHEN** the user clicks "Continue" in location picker mode
- **THEN** the app SHALL capture the map center coordinates and open the tour creation dialog with those coordinates

#### Scenario: Cancel location picking

- **WHEN** the user clicks "Cancel" in location picker mode
- **THEN** the crosshair SHALL disappear, the map action buttons SHALL reappear, and no tour is created

#### Scenario: Disabled when not logged in

- **WHEN** the user is not authenticated
- **THEN** the "Add Location" button SHALL be disabled

### Requirement: Map action overlay with FABs

The map page SHALL display floating action buttons for: base map style picker, user profile, add contact, and add location.

#### Scenario: Style picker button

- **WHEN** the user clicks the style picker FAB
- **THEN** a popup menu SHALL appear listing available map styles with a checkmark on the active one

#### Scenario: User profile button

- **WHEN** the user clicks the profile FAB
- **THEN** the user profile sheet SHALL open

#### Scenario: Add contact button

- **WHEN** the user clicks the add contact FAB
- **THEN** the contact creation dialog SHALL open

#### Scenario: Add location button

- **WHEN** the user clicks the add location FAB
- **THEN** the map SHALL enter location picker mode

#### Scenario: Buttons hidden during location picking

- **WHEN** the map is in location picker mode
- **THEN** all action overlay FABs SHALL be hidden

### Requirement: Map store manages map state

A Pinia store (`useMapStore`) SHALL manage map-related state: `isPickingLocation`, `currentStyleIndex`, `selectedTourId`.

#### Scenario: Toggle location picker

- **WHEN** `setPickingLocation(true)` is called
- **THEN** the store SHALL set `isPickingLocation` to true, hiding action buttons and showing picker controls

#### Scenario: Select tour

- **WHEN** `selectTour(tour)` is called
- **THEN** the store SHALL set `selectedTourId` and the map SHALL animate to the tour's location

#### Scenario: Change map style

- **WHEN** `setStyleIndex(index)` is called
- **THEN** the store SHALL update `currentStyleIndex` and trigger a map style reload

## MODIFIED Requirements

### Requirement: Map action overlay icons

The map action overlay SHALL display FABs with Material Symbols icons: `map` for base map picker, `person` for profile, `person_add` for add contact, and `add_location_alt` for add tour. FABs SHALL use glassmorphism styling (semi-transparent background with backdrop blur) for visual separation from map content.

#### Scenario: FABs display Material Symbols

- **WHEN** the map page loads with the action overlay visible
- **THEN** each FAB displays its corresponding Material Symbol icon instead of emoji

#### Scenario: FABs have glass effect

- **WHEN** the map action overlay is visible over map content
- **THEN** FAB backgrounds are semi-transparent with a blur effect

### Requirement: Base map picker styling

The base map picker dropdown SHALL have a glassmorphism background, updated shadow (`--shadow-lg`), and `--color-outline-variant` border. Menu items SHALL use `--color-on-surface` text with hover highlighting.

#### Scenario: Map picker dropdown renders with glass effect

- **WHEN** user opens the base map picker menu
- **THEN** the dropdown has a semi-transparent blurred background with subtle border

### Requirement: Location picker button styling

The location picker cancel and continue buttons SHALL use the updated button styling conventions. Cancel uses secondary style, continue uses primary style. Both SHALL have 12px border-radius.

#### Scenario: Location picker buttons render with updated styling

- **WHEN** the location picker is active
- **THEN** cancel and continue buttons display with the modern button styles

### Requirement: Round action button size and style

The round action button (FAB) component SHALL be 52px diameter (increased from 48px) with `--shadow-md` layered shadow. It SHALL accept Material Symbols icon content via its default slot.

#### Scenario: FAB renders at updated size

- **WHEN** a round action button is rendered
- **THEN** it is 52x52px with a layered shadow

### Requirement: Map action overlay exposes a feedback entry point

The map action overlay SHALL render a Feedback floating action button and SHALL emit an `openFeedback` event when the button is activated, without owning any feedback sheet state itself.

#### Scenario: Feedback FAB rendered

- **WHEN** the map action overlay is mounted and the user is not currently picking a location
- **THEN** a Feedback FAB SHALL be rendered alongside the existing profile, contact, and add-tour FABs

#### Scenario: Feedback FAB emits event

- **WHEN** the user taps the Feedback FAB
- **THEN** the overlay SHALL emit the `openFeedback` event
- **AND** the overlay SHALL NOT mutate any local sheet visibility state

### Requirement: Map page owns feedback sheet visibility

The map page SHALL own the visibility state of the Feedback sheet and SHALL render the shared `FeedbackSheet` component in response to the overlay's `openFeedback` event, consistent with how the profile and contact sheets are wired.

#### Scenario: Map page opens feedback sheet

- **WHEN** the map action overlay emits `openFeedback`
- **THEN** the map page SHALL set its `showFeedbackSheet` state to true and render the `FeedbackSheet` component

#### Scenario: Sheet close clears state

- **WHEN** the `FeedbackSheet` emits its close event
- **THEN** the map page SHALL set `showFeedbackSheet` to false and unmount the sheet
