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

Tours SHALL be rendered on the map as circle markers using a MapLibre circle layer backed by a GeoJSON source. The circle color SHALL be derived from the tour's `tourType` via a data-driven paint expression, grouped as: winter sports (skiing, snowboarding, skitour, splitboarding, ski-mountaineering) in blue, summer sports (hiking, mountaineering, climbing, mountain-biking, trailrunning) in red, paragliding in amber, and tours with a null or unrecognized type in neutral grey.

#### Scenario: Tours displayed on map

- **WHEN** the tours store has loaded tours
- **THEN** each tour SHALL appear as a circle marker at its goal coordinates

#### Scenario: Selected tour highlighted

- **WHEN** a user clicks on a tour circle
- **THEN** the selected tour SHALL render with a larger radius (18px vs default 14px) and a white stroke

#### Scenario: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

#### Scenario: Winter tour colored blue

- **WHEN** a tour has `tourType` set to skiing, snowboarding, skitour, splitboarding, or ski-mountaineering
- **THEN** its circle marker SHALL render in the winter (blue) palette color

#### Scenario: Summer tour colored red

- **WHEN** a tour has `tourType` set to hiking, mountaineering, climbing, mountain-biking, or trailrunning
- **THEN** its circle marker SHALL render in the summer (red) palette color

#### Scenario: Paragliding tour colored amber

- **WHEN** a tour has `tourType` set to paragliding
- **THEN** its circle marker SHALL render in the paragliding (amber) palette color

#### Scenario: Unknown tour type falls back to neutral

- **WHEN** a tour has `tourType` set to null
- **THEN** its circle marker SHALL render in the neutral (grey) fallback color

### Requirement: Edit-mode preview marker matches tour type

When a user is editing an existing tour's goal location, the map SHALL render a tentative preview circle at the candidate coordinates. The preview circle's color SHALL be a lighter variant of the selected tour's type-based color, preserving the "tentative / not yet committed" visual cue. When no tour is selected or the tour's type is null, the preview SHALL use the neutral-light fallback color.

#### Scenario: Preview for winter tour uses light blue

- **WHEN** the user is editing a tour of a winter type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter blue than the saved marker color

#### Scenario: Preview for summer tour uses light red

- **WHEN** the user is editing a tour of a summer type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter red

#### Scenario: Preview for paragliding tour uses light amber

- **WHEN** the user is editing a paragliding tour and has picked a new tentative goal
- **THEN** a circle marker SHALL appear in a lighter amber

#### Scenario: Preview cleared on exit

- **WHEN** the user exits edit mode or cancels the tentative pick
- **THEN** the preview circle SHALL disappear

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

### Requirement: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

The camera offset behavior SHALL be responsive: on mobile viewports (<600px), the map SHALL apply bottom padding equal to the sheet height to keep the tour marker visible above the sheet. On desktop viewports (>=600px), the map SHALL apply right padding equal to the side drawer width to keep the tour marker centered in the visible map area beside the drawer.

#### Scenario: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

#### Scenario: Camera offset on mobile

- **WHEN** a tour is selected on a viewport below 600px
- **THEN** the map SHALL fly to the tour location with bottom padding equal to the sheet height

#### Scenario: Camera offset on desktop with side drawer

- **WHEN** a tour is selected on a viewport at or above 600px
- **THEN** the map SHALL fly to the tour location with right padding equal to the side drawer width (400px)

### Requirement: Dismiss modal bottom sheets via map background click

When a modal bottom sheet is open and the user clicks on the map background (outside the sheet), the sheet SHALL close, returning the user to the map view without performing any action.

#### Scenario: Click outside closes open sheet

- **WHEN** a modal bottom sheet (profile, contact creation, feedback, or tour detail) is open
- **AND** the user clicks on the map background area outside the sheet
- **THEN** the sheet SHALL dismiss (close)

#### Scenario: Click inside sheet does not close it

- **WHEN** a modal bottom sheet is open
- **AND** the user clicks anywhere within the sheet content area
- **THEN** the sheet SHALL remain open

#### Scenario: Overlay backdrop receives click events

- **WHEN** a modal bottom sheet is rendered
- **THEN** the map page SHALL render a transparent backdrop overlay behind the sheet
- **AND** clicks on the backdrop SHALL trigger the sheet's close action

#### Scenario: Only one sheet closes at a time

- **WHEN** a click on the map background occurs with exactly one sheet open
- **THEN** only that sheet SHALL close
- **AND** no other state changes SHALL occur

#### Scenario: Escape key also closes sheet

- **WHEN** a modal bottom sheet is open
- **AND** the user presses the Escape key
- **THEN** the sheet SHALL dismiss

#### Scenario: Dismissal does not lose form data warning

- **WHEN** a sheet with a form contains unsaved data
- **AND** the user clicks outside the sheet
- **THEN** the sheet SHALL close without additional confirmation (data loss is acceptable for MVP)

#### Scenario: Sheet close emits close event

- **WHEN** the map page closes a sheet in response to a backdrop click
- **THEN** the sheet component SHALL emit its standard `close` event
- **AND** the map page SHALL handle that event identically to an explicit close button press
