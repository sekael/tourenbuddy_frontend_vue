## ADDED Requirements

### Requirement: Pick-type label in collapsed overlay header

While the location picker is active, the surrounding tour creation dialog and tour info sheet collapse to a header-only surface (bottom sheet on mobile, side-drawer compact header on desktop). That collapsed header SHALL display a label naming the location type currently being picked, so the user retains context once the form is hidden.

The label SHALL resolve from the active pick type:

- `goal` → "Tour Goal" / "Tourenziel"
- `start` → "Start Point" / "Startpunkt"
- `end` → "End Point" / "Endpunkt"

The `location-picker.vue` component itself SHALL NOT render an additional title bar over the map canvas.

#### Scenario: Goal pick on mobile

- **WHEN** the user is on a mobile viewport and enters location-pick mode with pick type `goal`
- **THEN** the bottom sheet SHALL be collapsed to its header row and the title SHALL read "Tour Goal" (or its localized equivalent)

#### Scenario: Start pick on desktop

- **WHEN** the user is on a desktop viewport and enters location-pick mode with pick type `start`
- **THEN** the side drawer SHALL be in its collapsed top-right header state and the title SHALL read "Start Point" (or its localized equivalent)

#### Scenario: End pick label

- **WHEN** the user enters location-pick mode with pick type `end` on either viewport
- **THEN** the collapsed overlay header SHALL read "End Point" (or its localized equivalent)

#### Scenario: No standalone title bar on map canvas

- **WHEN** location-pick mode is active for any pick type
- **THEN** `location-picker.vue` SHALL NOT render a title bar over the map; the only label SHALL be the one in the collapsed overlay header

### Requirement: Start and end point metadata auto-fetch

When the user confirms a start or end point pick, the system SHALL fetch elevation and a name suggestion from Swisstopo in parallel and pass the results to the tour form.

#### Scenario: Start point pick auto-fills metadata

- **WHEN** the user confirms a `start` location pick
- **THEN** the system SHALL call the elevation service and name-suggestion service for the picked coordinates and store the results as the start point's name and elevation in the draft

#### Scenario: End point pick auto-fills metadata

- **WHEN** the user confirms an `end` location pick
- **THEN** the system SHALL call the elevation service and name-suggestion service for the picked coordinates and store the results as the end point's name and elevation in the draft

#### Scenario: Service failure leaves metadata null

- **WHEN** elevation or name suggestion fails for a start or end pick
- **THEN** the corresponding metadata field SHALL be null and the coordinate SHALL still be stored

### Requirement: Start and end point rows display metadata

When a start or end point has an associated name and/or elevation, the tour form row for that point SHALL display them alongside the coordinates.

#### Scenario: Start point with name and elevation

- **WHEN** the form renders a start point that has both `startPointName` and `startPointElevation`
- **THEN** the row SHALL show the name and elevation in addition to the coordinates

#### Scenario: Start point with coordinates only

- **WHEN** the form renders a start point with null name and null elevation
- **THEN** the row SHALL show only the coordinates

### Requirement: Elevation field with auto-fill indicator

The tour creation dialog SHALL display an elevation number input. When auto-filled from Swisstopo, it SHALL show a subtle indicator (e.g., icon or label) that the value was auto-retrieved.

#### Scenario: Auto-filled elevation displayed

- **WHEN** elevation was auto-retrieved
- **THEN** the field SHALL show the value with an auto-fill indicator
- **AND** the user SHALL be able to edit the value

#### Scenario: Manual elevation entry

- **WHEN** no auto-fill is available
- **THEN** the field SHALL be empty with placeholder "Elevation (m)"

### Requirement: Description textarea

The tour creation dialog SHALL include a multi-line textarea for description/guide text.

#### Scenario: User enters description

- **WHEN** the user types text into the description field
- **THEN** the value SHALL be stored in the draft as plain text

### Requirement: Season chip selector

The tour creation dialog SHALL include season chips (Winter, Spring, Summer, Autumn) supporting multi-select.

#### Scenario: Multiple seasons selected

- **WHEN** the user taps Winter and Spring chips
- **THEN** both SHALL be highlighted and `seasons` SHALL contain `['winter', 'spring']`

#### Scenario: Toggle season off

- **WHEN** the user taps an already-selected season chip
- **THEN** it SHALL be deselected and removed from the seasons array

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

### Requirement: Point picker action rows stay within their bounded section

The action button row inside each `.point-section` (goal, start, end) SHALL remain visually contained within its bounded background across all supported viewport widths (down to ~320 CSS px). When the combined intrinsic width of the action buttons exceeds the available row width, the buttons SHALL wrap onto additional lines rather than overflowing the section background.

#### Scenario: End-point section on a narrow mobile viewport

- **WHEN** the user opens the tour form on a viewport ≤ 360 CSS px wide with a start point set and no end point set
- **THEN** the "Add End Point" and "Round Trip" buttons SHALL both render fully inside the end-point section's bounded background, wrapping onto a second line if they do not fit side by side

#### Scenario: End-point section on a wide viewport

- **WHEN** the user opens the tour form on a viewport wide enough to fit both action buttons on one line
- **THEN** the buttons SHALL render side by side on a single line as today

### Requirement: Equipment textarea

The tour creation dialog SHALL include a multi-line textarea for equipment/gear lists.

#### Scenario: User enters equipment

- **WHEN** the user types equipment text
- **THEN** the value SHALL be stored in the draft

### Requirement: Notes textarea

The tour creation dialog SHALL include a multi-line textarea for miscellaneous notes.

#### Scenario: User enters notes

- **WHEN** the user types notes
- **THEN** the value SHALL be stored in the draft

### Requirement: GPX upload control

The tour creation dialog SHALL include a file upload button for GPX files.

#### Scenario: GPX file selected

- **WHEN** the user selects a GPX file
- **THEN** the filename SHALL be displayed with a remove button
- **AND** a preview indicator SHALL confirm successful parsing

### Requirement: Adaptive form layout

The form SHALL organize fields into logical sections and remain usable regardless of which optional fields the user fills.

#### Scenario: Mobile layout

- **WHEN** the dialog is displayed on mobile (viewport < 600px)
- **THEN** it SHALL render as a full-screen sheet with scrollable content

#### Scenario: Desktop layout

- **WHEN** the dialog is displayed on desktop (viewport >= 600px)
- **THEN** it SHALL render as a centered dialog with scrollable content and max-width 560px

#### Scenario: Minimal fields filled

- **WHEN** the user only fills the tour type and confirms
- **THEN** the form SHALL submit without validation errors on empty optional fields

### Requirement: Attachments section in tour form

The tour creation/edit form SHALL include an "Attachments" section allowing the user to add, delete, and reorder up to 5 attachments (png/jpeg/pdf, ≤10 MB each) for the tour.

#### Scenario: Add attachment from form

- **WHEN** the user taps the add-attachment control and selects a valid file
- **THEN** the file SHALL be uploaded and SHALL appear in the section as a thumbnail/row with filename

#### Scenario: Delete from form

- **WHEN** the user taps the delete control on an attachment row
- **THEN** the attachment SHALL be removed from the list and from storage

#### Scenario: Reorder from form

- **WHEN** the user drags an attachment row to a new position
- **THEN** the new order SHALL persist after the form is closed and reopened

#### Scenario: Limit reached in form

- **WHEN** the tour already has 5 attachments
- **THEN** the add control SHALL be disabled with a user-visible explanation

#### Scenario: Invalid file in form

- **WHEN** the user selects a file that is too large or of disallowed type
- **THEN** an inline error SHALL be shown AND no upload SHALL occur

#### Scenario: Available during create

- **WHEN** the user is creating a new tour (no `tour_id` yet)
- **THEN** the attachments section SHALL be available and uploads SHALL associate with the tour upon save (or be deferred until the tour row exists, per implementation)
