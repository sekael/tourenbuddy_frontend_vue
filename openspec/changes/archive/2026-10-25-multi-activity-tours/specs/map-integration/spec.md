## MODIFIED Requirements

### Requirement: Tour markers rendered as circles

Tours SHALL be rendered on the map as circle markers using a MapLibre circle layer backed by a GeoJSON source. The circle color SHALL be derived from the tour's activity types, grouped as: winter sports (skiing, snowboarding, skitour, splitboarding, ski-mountaineering) in blue, summer sports (hiking, mountaineering, climbing, mountain-biking, trailrunning) in red, paragliding in amber, and tours with no type in neutral grey. A tour whose types map to more than one of these colors SHALL render split between them (see "Multi-activity markers split between their colours").

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

- **WHEN** a tour's types are all among skiing, snowboarding, skitour, splitboarding, or ski-mountaineering
- **THEN** its circle marker SHALL render in the winter (blue) palette color

#### Scenario: Summer tour colored red

- **WHEN** a tour's types are all among hiking, mountaineering, climbing, mountain-biking, or trailrunning
- **THEN** its circle marker SHALL render in the summer (red) palette color

#### Scenario: Paragliding tour colored amber

- **WHEN** a tour's only type is paragliding
- **THEN** its circle marker SHALL render in the paragliding (amber) palette color

#### Scenario: Unknown tour type falls back to neutral

- **WHEN** a tour has no activity type
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


### Requirement: Edit-mode preview marker matches tour type

When a user is editing an existing tour's goal location **or creating a new tour**, the map SHALL render a tentative draft preview circle at the candidate goal coordinates. The preview circle's color SHALL be a lighter variant of the relevant tour's type-based color (split the same way as a saved marker when the types span several colors), preserving the "tentative / not yet committed" visual cue. While the form is open the relevant types are the activity types currently selected in the form, during editing and creation alike. When no type is selected (including the start of creation before any activity is chosen, or after the user deselects every type), the preview SHALL use the neutral-light fallback color.

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

- **WHEN** the user selects, adds or removes an activity type in the creation form
- **THEN** the draft marker SHALL update to the matching lighter shade(s) of the selected types' colors within the same reactive tick

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


## ADDED Requirements

### Requirement: Multi-activity markers split between their colours

A tour whose activity types map to two or three distinct palette colours SHALL render each of its circle markers — goal, selected goal, start/end detail and draft preview — as a circle divided into equal slices, one per distinct colour, in the order of its types. Types sharing a colour SHALL count once. Size, stroke, opacity and overlay glyphs SHALL match a single-colour marker.

#### Scenario: Ski tour and hike

- **WHEN** a tour has types `skitour` and `hiking`
- **THEN** its goal marker SHALL show a blue half and a red half

#### Scenario: Types of one colour stay solid

- **WHEN** a tour has types `skitour` and `splitboarding`
- **THEN** its goal marker SHALL render solid blue, exactly like a single-type ski tour

#### Scenario: Selected split marker keeps its ring

- **WHEN** a split tour is selected
- **THEN** its marker SHALL keep the slices at the selected size with the white selected-state stroke around them

### Requirement: Cluster pies weight tours by their colours

A cluster pie SHALL give each member tour a total weight of one, divided equally among the tour's distinct colours, so slice sizes reflect tours rather than type counts. The number shown SHALL remain the count of tours. Spiderfied leaves and leaf tween dots of a split tour SHALL show its colours split the same way.

#### Scenario: Mixed cluster

- **WHEN** a cluster holds one ski tour and one ski-tour-and-hike tour
- **THEN** its pie SHALL be three quarters blue and one quarter red
- **AND** it SHALL show the count 2
