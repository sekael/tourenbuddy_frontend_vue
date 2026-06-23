## Purpose

MapLibre GL JS map with Swisstopo vector and WMTS layers, marker layers for tours, and bidirectional camera sync with the store.

## Requirements

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

Each GeoJSON feature SHALL additionally carry a `completed` boolean property mirroring the tour's `completed` field. Completed tours SHALL be rendered with a visually distinct style — a check glyph overlaid on the circle via a sibling symbol layer, or, when the symbol layer is not available, a grayscale-mixed variant of the type-based circle color. The circle radius and stroke for completed tours SHALL remain identical to not-completed tours. Selected-state styling (larger radius, white stroke) SHALL apply to completed tours identically, and the check glyph SHALL still render on top of the selected-state circle. Clicking a completed tour's marker SHALL trigger the same selection and fly-to behavior as a not-completed tour. GPX track rendering SHALL be unaffected by completion state. Not-completed tours SHALL render in the normal type-based color with no overlay.

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

#### Scenario: Completed tour shows distinct visual

- **WHEN** a tour has `completed === true`
- **THEN** the marker SHALL render either with a check glyph overlaid on the type-colored circle, or with a grayscale-mixed variant of the type-colored circle when the glyph layer is unavailable
- **AND** the circle radius and stroke SHALL be identical to not-completed markers

#### Scenario: Selected completed tour

- **WHEN** a completed tour becomes the selected tour
- **THEN** the marker SHALL show the selected-state larger radius and white stroke
- **AND** the check glyph SHALL remain rendered on top

#### Scenario: GPX track unaffected by completion

- **WHEN** a completed tour has a GPX track displayed on the map
- **THEN** the track SHALL render with the same style as for a not-completed tour

#### Scenario: Completion toggle reflects on map immediately

- **WHEN** a tour's `completed` field changes in the tours store
- **THEN** the corresponding map marker SHALL update its visual within the same reactive tick, with no page reload required

### Requirement: Start and end markers shown only while viewing or editing a tour's details

The map SHALL render a tour's **start** and **end** point markers ONLY while that tour's details are being viewed or edited (its info sheet is open, i.e. it is the selected tour) OR while a tour is being created. The standard map view, with no tour selected and no tour being created, SHALL NOT show any start or end markers. Start/end markers SHALL NOT participate in clustering, collision suppression, or the goal-marker click/selection behavior. Start/end markers SHALL be display-only (non-interactive): a tap on a start or end marker SHALL be swallowed — it SHALL NOT select a tour, fly to it, NOR dismiss the open info sheet or cancel an in-progress tour creation. The same start/end markers SHALL be shown for a partner friend tour's details exactly as for an owned tour, with no friend-specific icon on the start or end marker.

Start/end markers SHALL reuse the goal marker's GL rendering mechanism: a circle in the tour's type-based color with a sibling symbol layer carrying the icon, kept on a selection-scoped source separate from the clustering source, and rendered beneath the goal marker so the goal stays on top when they overlap.

A start/end marker SHALL reuse the goal marker's circle design and the tour's type-based color, distinguished by a centered white icon: the **start** marker SHALL carry the start icon and the **end** marker SHALL carry the end icon, matching the icons the tour info sheet uses for those points (`home` for start, `flag` for end). The completion check glyph SHALL remain on the goal marker only — completing a tour SHALL NOT change its start or end markers.

The **start** marker SHALL be shown whenever the tour has a start point. The **end** marker SHALL be shown ONLY when the tour has an end point that is distinct from the start point. A round-trip tour (end point equal to start point) and a one-way-to-goal tour (no end point) SHALL therefore show a start marker and no end marker, mirroring the info sheet's treatment.

When the tour's details are closed (deselected) the start/end markers SHALL be removed. On a map style switch the start/end markers SHALL be re-rendered for the still-selected tour, the same as the goal and GPX layers.

#### Scenario: Start and end markers appear when a tour's details open

- **WHEN** a tour with a start point and a distinct end point becomes the selected tour and its info sheet opens
- **THEN** a start marker SHALL render at the start point and an end marker at the end point, both in the tour's type-based color with the start/end icons respectively
- **AND** the goal marker SHALL continue to render as before

#### Scenario: No start/end markers on the standard map

- **WHEN** no tour is selected
- **THEN** no start or end markers SHALL be rendered anywhere on the map
- **AND** clustering and collision behavior SHALL be computed from goal markers only

#### Scenario: Round-trip tour shows start only

- **WHEN** the selected tour's end point equals its start point
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: One-way-to-goal tour shows start only

- **WHEN** the selected tour has a start point but no end point
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: Friend tour shows identical start/end markers

- **WHEN** a partner friend tour's details are open
- **THEN** its start/end markers SHALL render with the same design as an owned tour's, with no additional friend icon on the start or end marker

#### Scenario: Completion does not change start/end markers

- **WHEN** the selected tour is completed
- **THEN** the check glyph SHALL appear only on the goal marker
- **AND** the start and end markers SHALL render unchanged

#### Scenario: Tapping a start/end marker is swallowed, not dismissed

- **WHEN** the user taps a start or end marker while a tour's info sheet is open
- **THEN** no selection or fly-to SHALL occur (the goal marker remains the only selectable handle)
- **AND** the info sheet SHALL NOT close (the tap SHALL NOT be treated as a map-background click)

#### Scenario: Tapping a draft start/end marker does not cancel creation

- **WHEN** the user taps a start or end draft marker while creating a tour
- **THEN** the tour creation flow SHALL NOT be canceled

#### Scenario: Start/end markers removed on deselect

- **WHEN** the selected tour is deselected / its info sheet closes
- **THEN** the start and end markers SHALL be removed from the map

#### Scenario: Start/end markers survive a style switch

- **WHEN** the map base style is switched while a tour's details are open
- **THEN** the start and end markers SHALL be re-rendered for the still-selected tour after the new style loads

### Requirement: Edit-mode preview marker matches tour type

When a user is editing an existing tour's goal location **or creating a new tour**, the map SHALL render a tentative draft preview circle at the candidate goal coordinates. The preview circle's color SHALL be a lighter variant of the relevant tour's type-based color, preserving the "tentative / not yet committed" visual cue. During editing the relevant type is the selected tour's type; during creation it is the activity type currently selected in the creation form. When no type is selected yet (including the start of creation before any activity is chosen) or the type is null, the preview SHALL use the neutral-light fallback color.

During creation, picking a goal SHALL show the draft marker, and re-picking the goal SHALL move the single existing draft marker rather than adding a second one. When the user selects or changes the activity type in the creation form, the draft marker's color SHALL update to the matching lighter shade within the same reactive tick. On save the draft marker SHALL remain visible through the create round-trip and SHALL be cleared only once the real, full-color marker exists, so the light draft visibly transforms into the saved marker with no intervening empty-map gap. If the create fails, the draft marker SHALL still be cleared.

The same draft-preview mechanism SHALL extend to the **start** and **end** points. While creating or editing a tour, every set point (goal, start, end) SHALL be shown with its respective marker and icon. When a start or end location is changed during the edit/create flow, the changed point SHALL be shown as a lighter-tone draft marker carrying its start/end icon, in the same lighter shade rule used for the goal draft (type-based light color, or neutral-light when no type is selected). Unchanged points SHALL continue to render as their saved, full-color markers. On save, the start/end draft markers SHALL be promoted to saved markers the same way the goal draft is. Canceling the edit, or leaving a point's location unchanged, SHALL leave that point's marker unaffected.

#### Scenario: Preview for winter tour uses light blue

- **WHEN** the user is editing a tour of a winter type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter blue than the saved marker color

#### Scenario: Preview for summer tour uses light red

- **WHEN** the user is editing a tour of a summer type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter red

#### Scenario: Preview for paragliding tour uses light amber

- **WHEN** the user is editing a paragliding tour and has picked a new tentative goal
- **THEN** a circle marker SHALL appear in a lighter amber

#### Scenario: Draft marker appears on goal pick during creation

- **WHEN** the user picks a goal location to start creating a tour and no activity type has been chosen yet
- **THEN** a single draft preview circle SHALL appear at the picked goal in the neutral-light fallback color

#### Scenario: Re-picking the goal moves the draft marker

- **WHEN** the user changes the goal location during creation
- **THEN** the existing draft marker SHALL move to the new coordinates and NO additional draft marker SHALL be added

#### Scenario: Draft marker recolors live when activity type is selected during creation

- **WHEN** the user selects or changes the activity type in the creation form
- **THEN** the draft marker SHALL update to the matching lighter shade of that type's color within the same reactive tick

#### Scenario: Draft marker transforms into the saved marker on create

- **WHEN** the user saves the new tour
- **THEN** the draft marker SHALL stay on screen until the created tour is loaded into the store
- **AND** it SHALL then be replaced by the real activity-type-colored marker at the saved goal, with no empty-map gap during the create round-trip

#### Scenario: Draft marker cleared when create fails

- **WHEN** saving the new tour fails (e.g. the create request errors)
- **THEN** the draft marker SHALL be cleared rather than left dangling on the map

#### Scenario: Preview cleared on exit

- **WHEN** the user exits edit mode, cancels the tentative pick, or cancels tour creation
- **THEN** the preview circle SHALL disappear

#### Scenario: Changing a start point shows a draft start marker

- **WHEN** the user changes the start location while creating or editing a tour
- **THEN** a lighter-tone draft marker carrying the start icon SHALL appear at the new start location
- **AND** any unchanged goal or end markers SHALL keep their saved full-color rendering

#### Scenario: Changing an end point shows a draft end marker

- **WHEN** the user changes the end location while creating or editing a tour
- **THEN** a lighter-tone draft marker carrying the end icon SHALL appear at the new end location

#### Scenario: Start/end draft markers promote to saved on save

- **WHEN** the user saves edits that changed the start and/or end location
- **THEN** the changed point's draft marker SHALL become its saved, full-color marker

#### Scenario: Canceling edits leaves start/end markers unchanged

- **WHEN** the user cancels the edit, or leaves the start/end location unchanged
- **THEN** the start/end markers SHALL reflect the saved tour, with no lingering draft marker

### Requirement: Location picker with crosshair

The map SHALL support a location-picking mode where a crosshair overlay appears at the center of the viewport, and the user can pan to choose a location. While picking is active, the location picker SHALL be the only interactive UI; any open tour edit or tour creation surface SHALL be suspended (collapsed to a title-only header, inputs disabled, dismissal affordances hidden) and any submit path SHALL refuse to execute until picking ends. On confirm or cancel, picking ends and the suspended surface SHALL be restored to its prior interactive state.

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

#### Scenario: Suspends an open tour edit surface while picking

- **WHEN** the location picker is active
- **AND** a tour info sheet is open in edit mode
- **THEN** the tour edit surface SHALL render in a collapsed header-only state showing "Edit: <tour title>"
- **AND** all form inputs and non-picker action buttons inside the edit surface SHALL be disabled
- **AND** backdrop / map-background / Escape dismissal of the edit surface SHALL be suppressed
- **AND** the edit surface SHALL NOT expose a close button

#### Scenario: Suspends the tour creation dialog while re-picking

- **WHEN** the location picker is re-opened from within the tour creation dialog to pick start, end, or goal
- **THEN** the tour creation dialog SHALL be suspended equivalently (collapsed header, disabled inputs, dismissal suppressed) until picking ends

#### Scenario: Restores the suspended surface on confirm

- **WHEN** the user confirms the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the newly picked coordinates applied to the target field, and all other in-progress form values SHALL be preserved

#### Scenario: Restores the suspended surface on cancel

- **WHEN** the user cancels the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the target field unchanged, and all other in-progress form values SHALL be preserved

### Requirement: Map action overlay with FABs

The map page SHALL display floating action buttons in the bottom-right speed dial for: base map style picker, user profile, contacts, and feedback. The previously top-level Tours and Add-tour FABs SHALL NOT be part of the speed dial — they are owned by the persistent bottom-center tour action bar. The speed-dial trigger SHALL be disabled while any overlay is active (`activeOverlay !== null`).

#### Scenario: Style picker button

- **WHEN** the user clicks the style picker entry in the speed-dial menu
- **THEN** a popup panel SHALL appear listing available map styles with a checkmark on the active one

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

### Requirement: Map page registers the tours overlay

`map-page.vue` SHALL extend its `OverlayName` union with `'tours'` and SHALL mount `TourListSheet` inside the same unified overlay container that hosts the other single-active overlays. Opening the tours overlay SHALL follow the existing single-active policy so that any other open overlay (contacts, profile, feedback, tour, tour-creation) closes when the tours overlay opens.

#### Scenario: Open tours overlay closes other overlays

- **WHEN** the tour action bar's My Tours segment is activated
- **THEN** `map-page.vue` SHALL set `activeOverlay` to `'tours'`, causing any previously active overlay to unmount
- **AND** `TourListSheet` SHALL mount

#### Scenario: Tour list close resets overlay state

- **WHEN** `TourListSheet` emits `close`
- **THEN** `map-page.vue` SHALL reset `activeOverlay` so no overlay is active

#### Scenario: Selecting a tour from the list hands off to TourInfoSheet

- **WHEN** the user taps a tour row inside `TourListSheet`
- **THEN** `mapStore.selectTour(tourId)` SHALL be called and `TourListSheet` SHALL emit `close`
- **AND** the existing map-page reaction to `selectedTourId` SHALL open `TourInfoSheet` and fly the camera to the tour's goal

## MODIFIED Requirements

### Requirement: Map action overlay icons

The speed-dial action overlay SHALL display FABs with Material Symbols icons: `map` for base map picker, `person` for profile, `group` for contacts, and `feedback` for feedback. FABs SHALL use glassmorphism styling (semi-transparent background with backdrop blur) for visual separation from map content.

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
- **THEN** a Feedback FAB SHALL be rendered alongside the existing profile and contacts FABs

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

### Requirement: Cluster membership is a stable hierarchical tree

The renderer SHALL maintain a single hierarchical agglomerative cluster tree, built once per `updateTours` invocation, that fully determines cluster membership at every zoom level. Two tours that are in the same cluster at zoom Z SHALL remain in the same cluster lineage at every zoom Z' &le; Z; conversely, two tours separated at zoom Z SHALL remain separated at every zoom Z' &ge; Z. Cluster identity SHALL NOT depend on tile boundaries, snapshot timing, or non-monotone re-grouping. The tree SHALL persist between zoom changes and pans, and SHALL be discarded only when `updateTours` is called with a different tour list.

#### Scenario: Two tours that cluster at low zoom remain co-clustered at all lower zooms

- **GIVEN** two tours A and B that the tree assigns to the same cluster at zoom 10
- **WHEN** the user zooms out to zoom 8 and back to zoom 10 several times
- **THEN** A and B SHALL be assigned to the same cluster lineage at every zoom Z &le; 10 throughout the session

#### Scenario: Two tours that separate at high zoom remain separated at all higher zooms

- **GIVEN** two tours A and B whose merge node has `splitZoom = 11`
- **WHEN** the user zooms in past zoom 11 and back several times
- **THEN** A and B SHALL be rendered as separate visible nodes at every zoom Z > 11 throughout the session

#### Scenario: Tree rebuild on tour list change

- **WHEN** `updateTours` is invoked with a new tour list
- **THEN** the tree SHALL be rebuilt from scratch using the new list
- **AND** any in-flight cluster animations SHALL be cancelled
- **AND** the renderer SHALL diff the previously committed visible state against the new forest cut at the current zoom and animate the resulting differences

### Requirement: Cluster split / merge animations fire only when a `splitZoom` threshold is crossed

The renderer SHALL fire a split or merge animation if and only if the user's zoom gesture crosses the `splitZoom` of at least one tree node. Pan gestures, intra-band zoom (zoom changes that do not cross any node's `splitZoom`), and programmatic camera moves that do not cross thresholds SHALL produce zero marker churn — visible markers SHALL translate with the map but SHALL NOT be removed, recreated, or faded. Animations SHALL be triggered during the gesture (not deferred to `zoomend`) by sampling `zoom` events and detecting threshold crossings against the previously sampled zoom.

#### Scenario: Pure pan produces no animation

- **WHEN** the user pans the map without changing zoom
- **THEN** no split or merge animation SHALL fire
- **AND** the visible cluster and tour markers SHALL remain mounted in the DOM

#### Scenario: Zoom within a threshold-free band produces no animation

- **GIVEN** the closest two `splitZoom` values to the current zoom are at zoom 8 and zoom 11, and the current zoom is 9.5
- **WHEN** the user zooms to 10.4 and back to 9.5
- **THEN** no split or merge animation SHALL fire

#### Scenario: Crossing one threshold during zoom-in fires one split animation

- **GIVEN** a node N has `splitZoom = 10.3`
- **WHEN** the user zooms from zoom 10.0 to zoom 10.6 in a single gesture
- **THEN** the renderer SHALL fire exactly one split animation for N during the gesture, beginning when the zoom crosses 10.3
- **AND** the animation SHALL begin before `zoomend` fires

#### Scenario: Crossing multiple thresholds during one gesture fires the corresponding animations

- **GIVEN** nodes N1, N2 have `splitZoom = 9.5, 10.5` respectively
- **WHEN** the user zooms from zoom 9.0 to zoom 11.0 in a single gesture
- **THEN** the renderer SHALL fire a split animation for N1 when the zoom crosses 9.5
- **AND** SHALL fire a split animation for N2 when the zoom crosses 10.5

### Requirement: Cluster click navigates to `splitZoom + ε` or spiderfies if unreachable

When the user clicks a cluster marker for node N, the renderer SHALL invoke `map.easeTo({ center: N.centroid, zoom: N.splitZoom + ε })` where `ε` is a small positive constant (≈ 0.01), unless `N.splitZoom > map.getMaxZoom()`, in which case the renderer SHALL invoke `spiderfier.spiderfy(N)` instead. The split animation that fires when the easeTo zoom crosses `N.splitZoom` SHALL be the same animation that would fire from a user-initiated zoom — there SHALL NOT be a separate click-driven animation code path.

#### Scenario: Click on expandable cluster zooms past split threshold

- **GIVEN** a cluster node N with `splitZoom = 12` and `map.getMaxZoom() = 18`
- **WHEN** the user clicks N's marker
- **THEN** `map.easeTo` SHALL be invoked with target zoom strictly greater than 12 (ε > 0)
- **AND** the standard split animation SHALL fire as the easeTo crosses zoom 12

#### Scenario: Click on un-expandable cluster spiderfies

- **GIVEN** a cluster node N with `splitZoom > map.getMaxZoom()` (e.g. tours at near-identical coordinates)
- **WHEN** the user clicks N's marker
- **THEN** the spiderfier SHALL be invoked with N's leaves
- **AND** `map.easeTo` SHALL NOT be invoked

### Requirement: Marker-granularity tweens for cluster transitions

Split and merge animations SHALL tween at the granularity of visible markers (cluster pies for cluster nodes, colored circles for leaf nodes), not at the granularity of every constituent leaf. For a split, the renderer SHALL spawn one temp marker per child of the splitting node, each starting at the parent centroid and tweening to its child centroid. For a merge, the renderer SHALL spawn one temp marker per disappearing visible node, each starting at the disappearing node's centroid and tweening to the new parent centroid. Temp markers for cluster children SHALL be constructed using the same pie-marker primitive as committed cluster markers; temp markers for leaf children SHALL be colored circles matching the tour-type palette. Animation duration SHALL be approximately 250 ms with a cubic ease-out.

#### Scenario: Split spawns one temp marker per direct child, not per leaf

- **GIVEN** a cluster N with two child clusters C1 (3 leaves) and C2 (2 leaves), and N is splitting
- **WHEN** the split animation fires
- **THEN** the renderer SHALL spawn exactly two temp markers (one for C1, one for C2)
- **AND** SHALL NOT spawn five temp markers (one per leaf)

#### Scenario: Merge spawns one temp marker per disappearing visible node

- **GIVEN** two visible cluster pies C1 and C2 are merging into a new parent P
- **WHEN** the merge animation fires
- **THEN** the renderer SHALL spawn exactly two temp markers, one tweening from C1.centroid → P.centroid and one from C2.centroid → P.centroid

#### Scenario: GL filter excludes animating tour ids

- **WHEN** a temp marker is animating for any tour id `t`
- **THEN** the GL `tours-circles` and `tours-circles-selected` layer filters SHALL exclude `t` for the duration of the animation
- **AND** SHALL re-include `t` immediately when the animation completes

### Requirement: Unified state-diff engine drives both zoom-driven and data-driven changes

The renderer SHALL implement a single state-diff engine that, on every change to either the cluster tree or the current zoom, computes the new forest (forest cut of the tree at the new zoom), diffs it against the previously committed visible state, and emits one of three transition kinds for each affected node: appeared, disappeared, or updated. For each appeared and disappeared node, the engine SHALL classify the cause as zoom-driven (an ancestor or descendant relationship to the previous state exists in the new tree) or data-driven (no such relationship), and SHALL select the corresponding animation: zoom-driven uses the merge / split tween; data-driven uses opacity fade-in / fade-out at the node's own centroid. Updated nodes (still visible but with a changed centroid or leaf set) SHALL tween their marker position from old to new centroid and re-render any pie-chart counts in place.

#### Scenario: Realtime tour add absorbed into existing cluster

- **GIVEN** a visible cluster pie C exists at zoom Z
- **WHEN** an external `updateTours` adds a new tour T whose tree placement at zoom Z assigns T to C
- **THEN** a temp colored dot for T SHALL animate from T's coordinates to C's new centroid
- **AND** C's marker SHALL tween its position from the old centroid to the new weighted centroid
- **AND** C's pie SVG SHALL re-render with updated counts

#### Scenario: Realtime tour add as a brand-new individual

- **WHEN** an external `updateTours` adds a tour T that is not clustered with any existing tour at the current zoom
- **THEN** T's GL circle SHALL fade in at its position via opacity transition
- **AND** no merge animation SHALL fire

#### Scenario: Tour deletion fades out

- **WHEN** an external `updateTours` removes a tour T that was visible as an individual circle
- **THEN** T's GL circle SHALL fade out at its position
- **AND** no merge or split animation SHALL fire

#### Scenario: Tour deletion shrinks a cluster

- **GIVEN** a visible cluster pie C of three leaves, one of which is tour T
- **WHEN** an external `updateTours` removes T
- **THEN** C's pie SVG SHALL re-render with the new total and counts
- **AND** C's marker SHALL tween its position from the old centroid to the new weighted centroid

#### Scenario: Mid-gesture data update cancels in-flight tweens and re-diffs

- **GIVEN** a split animation is in flight for cluster N during a user zoom gesture
- **WHEN** an external `updateTours` arrives
- **THEN** the in-flight tween SHALL be cancelled and its temp marker SHALL be removed
- **AND** the renderer SHALL recompute the forest from the new tree at the current zoom
- **AND** SHALL diff against the previously committed visible state and animate accordingly

### Requirement: GL `tours` source does not cluster

The MapLibre GL `tours` GeoJSON source SHALL be configured with `cluster: false` (or with no cluster option, which defaults to false). The `tours-circles`, `tours-circles-selected`, and `tours-completed-check` layers SHALL be filtered to the explicit set of currently-visible-as-individual tour ids, computed from the cluster tree's forest cut at the current zoom. There SHALL NOT be any reliance on MapLibre's internal point clustering for cluster behaviour, identity, or transitions.

#### Scenario: Source has no cluster option

- **WHEN** the `tours` source is added to the map
- **THEN** the `addSource` options SHALL NOT include `cluster: true`, `clusterMaxZoom`, or `clusterRadius`

#### Scenario: Layer filter is an explicit visible-id set

- **WHEN** the renderer commits a new visible state
- **THEN** each of `tours-circles`, `tours-circles-selected`, and `tours-completed-check` SHALL have its filter set to an `['in', ['get', 'id'], ['literal', [...visibleIds]]]` form combined with selection / animation exclusions

### Requirement: `splitZoom` is computed from world-meter centroid distance and pixel radius

For every internal tree node N with children C1 and C2, the `splitZoom` SHALL be computed as the zoom at which the projected pixel distance between `C1.centroid` and `C2.centroid` equals `CLUSTER_RADIUS = 50` pixels, using the standard Web Mercator pixels-per-meter formula evaluated at the merge node's centroid latitude. The post-build pass SHALL clamp every child's `splitZoom` to be greater than or equal to its parent's `splitZoom`, propagating recursively, to guarantee monotone visibility transitions during a continuous zoom.

#### Scenario: Two tours 100 m apart at latitude 47° have a deterministic `splitZoom`

- **GIVEN** two tour leaves at the same latitude 47.0° and exactly 100 m apart
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be the unique solution of `pixelDist = 50` per the Web Mercator formula
- **AND** the value SHALL be reproducible across builds for the same input

#### Scenario: Monotonicity clamp preserves child >= parent

- **GIVEN** centroid linkage produced a node N with `splitZoom = 9.0` whose parent P has `splitZoom = 9.5`
- **WHEN** the post-build clamp runs
- **THEN** `N.splitZoom` SHALL be set to `9.5` (or any value `>= 9.5`)

#### Scenario: Two tours at identical coordinates have effectively infinite `splitZoom`

- **GIVEN** two tour leaves at identical coordinates (distance = 0)
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be greater than `map.getMaxZoom()`
- **AND** clicking that cluster SHALL spiderfy

### Requirement: Reduced motion bypasses all marker tweens

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true, the renderer SHALL apply state diffs instantly: no temp marker animations, no opacity fades, no centroid tweens. Marker creation, removal, and centroid updates SHALL commit on the same frame as the diff.

#### Scenario: Threshold crossing with reduced motion enabled

- **GIVEN** `prefers-reduced-motion: reduce` is set
- **WHEN** the user zooms past a `splitZoom` threshold
- **THEN** no `requestAnimationFrame` tween SHALL be scheduled
- **AND** the cluster pie SHALL be removed and the child markers SHALL appear within the same frame as the threshold crossing
