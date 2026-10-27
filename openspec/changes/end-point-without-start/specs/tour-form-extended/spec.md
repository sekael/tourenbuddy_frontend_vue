## ADDED Requirements

### Requirement: Independent start and end point pickers

The tour form SHALL allow optional start and end point selection via map coordinate pickers. The end point section SHALL be offered once a start point is set, and SHALL also show whenever an end point is set without a start: an end point stands on its own. Picking or removing one point SHALL NOT change the other.

#### Scenario: Initial form shows start row only

- **WHEN** the form opens with no draft start or end point
- **THEN** the start point row SHALL be visible and the end point section SHALL NOT be rendered

#### Scenario: End point section appears after start is set

- **WHEN** the user confirms a start point pick (or the form opens with a draft that already has a start point)
- **THEN** the end point section SHALL be rendered, showing an "Add end point" button and a "Round Trip" button when no end point is yet set (a flown way down: "Add landing", and no "Round Trip")

#### Scenario: User sets start point

- **WHEN** the user activates the start point picker and confirms a location
- **THEN** the start point coordinates SHALL be stored in the draft and displayed; the end point SHALL remain unchanged

#### Scenario: User sets end point

- **WHEN** the user activates the end point picker and confirms a location
- **THEN** the end point coordinates SHALL be stored in the draft; the start point SHALL remain unchanged

#### Scenario: User removes end point

- **WHEN** the user clears a previously set end point
- **THEN** `endPoint`, `endPointName`, and `endPointElevation` SHALL be null in the draft and the row SHALL collapse back to the "Add end point" / "Round Trip" affordances (or "Add landing" for a flown way down)

#### Scenario: User removes the end point of a stage without a start

- **WHEN** the user clears the end point of a tour that has no start point
- **THEN** `endPoint`, `endPointName`, and `endPointElevation` SHALL be null in the draft and the end point section SHALL be hidden

#### Scenario: User removes start point and the end stays

- **WHEN** the user clears a previously set start point while an end point is set
- **THEN** `startPoint`, `startPointName`, and `startPointElevation` SHALL be null in the draft, and `endPoint`, `endPointName`, and `endPointElevation` SHALL keep their values, with the end point section still rendered

#### Scenario: User removes the only point

- **WHEN** the user clears a previously set start point while no end point is set
- **THEN** the start point fields SHALL be null in the draft and the end point section SHALL be hidden

#### Scenario: Editing a connected stage without a start

- **WHEN** the form opens for a tour that has an end point but no start point
- **THEN** the start point row SHALL offer a picker and the end point section SHALL show the end point with its name and elevation

#### Scenario: No start/end points

- **WHEN** the user does not set start or end points
- **THEN** both SHALL be null in the draft, representing a one-way tour from an unspecified start to the goal

## MODIFIED Requirements

### Requirement: Visual grouping of point sections

The tour form SHALL render each of goal, start point, and end point inside a distinct visual container so that name and elevation inputs are unambiguously scoped to one point. Each container SHALL display a header consisting of an icon and the section title, and SHALL use a distinct accent color so the three sections are visually separable at a glance.

#### Scenario: Three sections visually distinct

- **WHEN** the form renders with all three of goal, start, and end populated
- **THEN** each of the three SHALL be wrapped in its own card-style container with a colored left-border accent and an icon-prefixed header reading the section's localized title (Goal / Start Point / End Point — Landing when the way down is flown)

#### Scenario: Goal elevation belongs to goal section

- **WHEN** the form renders the goal section
- **THEN** the goal elevation input SHALL be located inside the goal section's container (not floating between the goal coordinates and the start point section)

### Requirement: Point picker action rows stay within their bounded section

The action button row inside each `.point-section` (goal, start, end) SHALL remain visually contained within its bounded background across all supported viewport widths (down to ~320 CSS px). When the combined intrinsic width of the action buttons exceeds the available row width, the buttons SHALL wrap onto additional lines rather than overflowing the section background.

#### Scenario: End-point section on a narrow mobile viewport

- **WHEN** the user opens the tour form on a viewport ≤ 360 CSS px wide with a start point set and no end point set
- **THEN** the "Add end point" and "Round Trip" buttons SHALL both render fully inside the end-point section's bounded background, wrapping onto a second line if they do not fit side by side

#### Scenario: End-point section on a wide viewport

- **WHEN** the user opens the tour form on a viewport wide enough to fit both action buttons on one line
- **THEN** the buttons SHALL render side by side on a single line as today

### Requirement: Start and end suggestions

With the goal set, an empty start card SHALL offer up to three suggestions: the user's latest own start for a goal within 300 m, then the public-transport stops nearest the goal, none within 500 m of it. An empty end card SHALL offer the user's latest own end the same way, then the nearest stops, none within 100 m of the start; a landing gets no stops. A suggestion SHALL set the point with its name and look up its height. Suggestions SHALL never block the form; a failed lookup SHALL show none.

#### Scenario: Stop near the Sustenhorn

- **WHEN** the goal is the Sustenhorn and the start is empty
- **THEN** "Steingletscher, Susten" SHALL be offered, and tapping it SHALL set the start there with that name and its height

#### Scenario: Been here before

- **WHEN** the user's earlier tour to the same summit started at "Tierberglihütte SAC"
- **THEN** that start SHALL be offered first

#### Scenario: Been here before, the way down

- **WHEN** the user's earlier tour to the same summit ended at "Steingletscher" and the end is empty
- **THEN** that end SHALL be offered first, before the nearest stops

### Requirement: Round Trip Tour shortcut

When a start point is set and no end point is set, the form SHALL render a "Round Trip" button (`tours.form.roundTripBtn`) — not for a flown way down, which offers "Add landing" instead — that copies the start point's coordinates, name, and elevation into the end point fields in a single action, so the user does not have to re-pick the same location.

#### Scenario: User clicks Round Trip Tour

- **WHEN** the user has set a start point, has no end point, and clicks "Round Trip"
- **THEN** `endPoint` SHALL be set to a copy of `startPoint`'s coordinates, `endPointName` SHALL equal `startPointName`, and `endPointElevation` SHALL equal `startPointElevation`

#### Scenario: Round Trip button hidden without start point

- **WHEN** no start point is set
- **THEN** the "Round Trip" button SHALL NOT be rendered (the end point section is hidden, or shows only an end point already set)

#### Scenario: Round Trip button hidden when end point already set

- **WHEN** an end point is already set
- **THEN** the "Round Trip" button SHALL NOT be rendered (only the populated end point row is shown)

## REMOVED Requirements

### Requirement: Start and end point pickers

**Reason**: It made an end point without a start an invalid form state and cleared the end when the start was removed. "Connect" on an outing gap writes exactly that state, and the cascade then destroyed the connection.

**Migration**: Replaced by "Independent start and end point pickers": same pickers and gating at creation, but an end set without a start shows, and removing the start keeps the end.
