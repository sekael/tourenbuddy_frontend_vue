## MODIFIED Requirements

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
