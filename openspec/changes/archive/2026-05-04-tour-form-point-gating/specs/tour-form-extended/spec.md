## MODIFIED Requirements

### Requirement: Start and end point pickers

The tour creation dialog SHALL allow optional start and end point selection via map coordinate pickers. The end point section SHALL be hidden entirely until a start point is set; an end point without a start is not a valid form state. Picking the start point SHALL NOT auto-fill the end point, and picking the end point SHALL NOT auto-fill the start point. When the user removes the start point, the end point and its metadata SHALL be cleared in the same action.

#### Scenario: Initial form shows start row only

- **WHEN** the form opens with no draft start or end point
- **THEN** the start point row SHALL be visible and the end point section SHALL NOT be rendered

#### Scenario: End point section appears after start is set

- **WHEN** the user confirms a start point pick (or the form opens with a draft that already has a start point)
- **THEN** the end point section SHALL be rendered, showing an "Add end point" button and a "Round Trip Tour" button when no end point is yet set

#### Scenario: User sets start point

- **WHEN** the user activates the start point picker and confirms a location
- **THEN** the start point coordinates SHALL be stored in the draft and displayed; the end point SHALL remain unchanged

#### Scenario: User sets end point

- **WHEN** the user activates the end point picker and confirms a location
- **THEN** the end point coordinates SHALL be stored in the draft; the start point SHALL remain unchanged

#### Scenario: User removes end point

- **WHEN** the user clears a previously set end point
- **THEN** `endPoint`, `endPointName`, and `endPointElevation` SHALL be null in the draft and the row SHALL collapse back to the "Add end point" / "Round Trip Tour" affordances

#### Scenario: User removes start point cascades to end point

- **WHEN** the user clears a previously set start point
- **THEN** `startPoint`, `startPointName`, `startPointElevation`, `endPoint`, `endPointName`, and `endPointElevation` SHALL all be null in the draft, and the end point section SHALL be hidden

#### Scenario: No start/end points

- **WHEN** the user does not set start or end points
- **THEN** both SHALL be null in the draft, representing a one-way tour from an unspecified start to the goal

## ADDED Requirements

### Requirement: Round Trip Tour shortcut

When a start point is set and no end point is set, the form SHALL render a "Round Trip Tour" button that copies the start point's coordinates, name, and elevation into the end point fields in a single action, so the user does not have to re-pick the same location.

#### Scenario: User clicks Round Trip Tour

- **WHEN** the user has set a start point, has no end point, and clicks "Round Trip Tour"
- **THEN** `endPoint` SHALL be set to a copy of `startPoint`'s coordinates, `endPointName` SHALL equal `startPointName`, and `endPointElevation` SHALL equal `startPointElevation`

#### Scenario: Round Trip button hidden without start point

- **WHEN** no start point is set
- **THEN** the "Round Trip Tour" button SHALL NOT be rendered (the entire end point section is hidden)

#### Scenario: Round Trip button hidden when end point already set

- **WHEN** an end point is already set
- **THEN** the "Round Trip Tour" button SHALL NOT be rendered (only the populated end point row is shown)

### Requirement: Visual grouping of point sections

The tour form SHALL render each of goal, start point, and end point inside a distinct visual container so that name and elevation inputs are unambiguously scoped to one point. Each container SHALL display a header consisting of an icon and the section title, and SHALL use a distinct accent color so the three sections are visually separable at a glance.

#### Scenario: Three sections visually distinct

- **WHEN** the form renders with all three of goal, start, and end populated
- **THEN** each of the three SHALL be wrapped in its own card-style container with a colored left-border accent and an icon-prefixed header reading the section's localized title (Tour Goal / Start Point / End Point)

#### Scenario: Goal elevation belongs to goal section

- **WHEN** the form renders the goal section
- **THEN** the goal elevation input SHALL be located inside the goal section's container (not floating between the goal coordinates and the start point section)
