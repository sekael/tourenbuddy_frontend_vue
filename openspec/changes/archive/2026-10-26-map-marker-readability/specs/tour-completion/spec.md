## MODIFIED Requirements

### Requirement: Completed tour marker visual distinction

The map SHALL render completed tours with a visually distinct marker compared to not-completed tours of the same type. The encoding SHALL be a completion badge, a small green disc with a white check on the lower right edge of the tour's colored circle, leaving the activity glyph in the circle visible. If the badge layer is not feasible in the current MapLibre setup, completed tours SHALL instead render the circle color as a grayscale mix of the tour-type color. The circle radius and stroke SHALL remain identical to not-completed markers, and clicking a completed marker SHALL behave identically to clicking a not-completed one. A completed tour's name label SHALL read "done" in place of its date.

#### Scenario: Completed tour shows check marker

- **WHEN** a tour has `completed === true` and the badge layer is active
- **THEN** the map SHALL render the completion badge on the lower right edge of the tour's circle marker
- **AND** the circle color SHALL remain the tour-type color

#### Scenario: Completed tour grayscale fallback

- **WHEN** a tour has `completed === true` and the badge layer is not available
- **THEN** the circle marker SHALL render with a grayscale mix of the tour-type color

#### Scenario: Selected completed tour retains highlight and glyph

- **WHEN** a completed tour is the currently selected tour
- **THEN** the selected-state styling (larger radius, white stroke) SHALL apply identically to not-completed selected tours
- **AND** the completion badge SHALL still be rendered on top

#### Scenario: Completed tour click behavior unchanged

- **WHEN** a user clicks a completed tour's marker
- **THEN** the map SHALL fly to the tour location and show the tour info component, identical to a not-completed tour click

#### Scenario: Not-completed tour unaffected

- **WHEN** a tour has `completed === false`
- **THEN** the circle marker SHALL render in the normal tour-type color with no completion badge

#### Scenario: GPX track rendering unchanged

- **WHEN** a completed tour has a GPX track
- **THEN** the track SHALL render with the same style as a not-completed tour's track
