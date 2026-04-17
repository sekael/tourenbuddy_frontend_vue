## MODIFIED Requirements

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

## ADDED Requirements

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
