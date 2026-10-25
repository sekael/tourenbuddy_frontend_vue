## Purpose

Tour info sheet that surfaces extended tour fields, attachments, and participants in a read-friendly layout.

## Requirements

### Requirement: Start and end point metadata display

When a tour has a name and/or elevation associated with its start or end point, the info sheet SHALL display them alongside the coordinate row for that point.

#### Scenario: Start point with name and elevation

- **WHEN** the tour has `startPoint`, `startPointName`, and `startPointElevation`
- **THEN** the start point row SHALL display the name and elevation in addition to coordinates

#### Scenario: End point with name only

- **WHEN** the tour has `endPoint` and `endPointName` but null `endPointElevation`
- **THEN** the end point row SHALL display the name and coordinates without an elevation value

#### Scenario: Point with coordinates only

- **WHEN** a start or end point has null name and null elevation
- **THEN** the row SHALL display only the coordinates (existing behavior preserved)

### Requirement: Elevation display

The tour info sheet SHALL display the elevation with the `landscape` Material Symbol icon.

#### Scenario: Elevation present

- **WHEN** the tour has an elevation value
- **THEN** the info sheet SHALL display it formatted as "X'XXX m" (with thousands separator)

#### Scenario: No elevation

- **WHEN** the tour has null elevation
- **THEN** no elevation row SHALL be displayed

### Requirement: Description display with auto-linked URLs

The tour info sheet SHALL display the description text with URLs automatically converted to clickable links.

#### Scenario: Description with URL

- **WHEN** the tour description contains "Check https://example.com for details"
- **THEN** the URL portion SHALL render as a clickable `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"`

#### Scenario: Description without URLs

- **WHEN** the tour description contains only plain text
- **THEN** it SHALL render as plain text

#### Scenario: No description

- **WHEN** the tour has null description
- **THEN** no description section SHALL be displayed

### Requirement: Season tags display

The tour info sheet SHALL display seasons as colored chips/tags.

#### Scenario: Seasons present

- **WHEN** the tour has one or more seasons
- **THEN** they SHALL be displayed as small tag chips (e.g., "Winter", "Spring")

#### Scenario: No seasons

- **WHEN** the tour has null or empty seasons
- **THEN** no season row SHALL be displayed

### Requirement: Start/end point display

The tour info sheet SHALL display start and end points with route icons. When the start point is set without an end point, the sheet SHALL indicate a one-way tour to the goal rather than a round trip.

#### Scenario: Start and end points set

- **WHEN** the tour has both start and end points
- **THEN** they SHALL be displayed as two coordinate rows with `trip_origin` and `flag` icons

#### Scenario: Only start point (one-way to goal)

- **WHEN** the tour has a start point but null end point
- **THEN** the start point SHALL be displayed with a "One-way to goal" indicator

#### Scenario: No start/end points

- **WHEN** both start and end points are null
- **THEN** no start/end point rows SHALL be displayed

### Requirement: Equipment display

The tour info sheet SHALL display equipment text with the `backpack` Material Symbol icon.

#### Scenario: Equipment present

- **WHEN** the tour has equipment text
- **THEN** it SHALL be displayed as a text block

#### Scenario: No equipment

- **WHEN** equipment is null
- **THEN** no equipment row SHALL be displayed

### Requirement: Notes display

The tour info sheet SHALL display notes text with the `sticky_note_2` Material Symbol icon.

#### Scenario: Notes present

- **WHEN** the tour has notes text
- **THEN** it SHALL be displayed as a text block

#### Scenario: No notes

- **WHEN** notes is null
- **THEN** no notes row SHALL be displayed

### Requirement: GPX track indicator

The tour info sheet SHALL indicate when a GPX track is available.

#### Scenario: GPX track present

- **WHEN** the tour has a GPX track
- **THEN** the info sheet SHALL display a "Track available" indicator with the `route` icon
- **AND** the GPX track SHALL be visible on the map

#### Scenario: No GPX track

- **WHEN** the tour has no GPX track
- **THEN** no track indicator SHALL be displayed

### Requirement: Adaptive info layout

The info sheet SHALL only display sections for fields that have values, maintaining clean spacing.

#### Scenario: Tour with all fields

- **WHEN** all optional fields are populated
- **THEN** all sections SHALL be displayed in logical order with consistent spacing

#### Scenario: Tour with minimal fields

- **WHEN** only name and goal are set (legacy tour)
- **THEN** only name and coordinates SHALL be displayed, with no empty sections or gaps

### Requirement: Completion toggle control

The tour info sheet SHALL display the completion toggle as a labelled tonal button in the owner toggles row directly below the hero, beside the visibility toggle. Not completed, it SHALL show an empty circle and the action label "Complete Tour"; completed, a check-circle on a success tint and the label "Completed". It SHALL expose its state as a pressed state. Activation SHALL invoke the tours store `setCompleted` action instantly — no confirmation dialog — for both mark and unmark directions.

#### Scenario: Toggle shown for tour owner

- **WHEN** the info sheet is opened by the tour's owner
- **THEN** the completion toggle control SHALL be visible in the owner toggles row below the hero, beside the visibility toggle
- **AND** its visual state SHALL reflect the tour's current `completed` field (check-circle on a success tint if true, empty circle if false)

#### Scenario: Toggle hidden or disabled for non-owner

- **WHEN** the info sheet is opened by a user who does not own the tour
- **THEN** the completion toggle control SHALL be hidden or rendered as non-interactive (consistent with how edit and delete are gated for non-owners)

#### Scenario: Mark tour completed from info sheet

- **WHEN** the tour is not completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, true)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the completed state

#### Scenario: Unmark tour from info sheet

- **WHEN** the tour is completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, false)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the not-completed state

#### Scenario: Failure surfaced to user

- **WHEN** `setCompleted` fails and rolls back
- **THEN** the toggle control SHALL reflect the original state
- **AND** the error SHALL be surfaced via the existing snackbar/error presentation pattern

### Requirement: Attachments list in tour info

The tour info sheet SHALL display the tour's attachments as a horizontal scrollable strip of thumbnails (image preview for images, generic PDF icon for PDFs) with filename labels, ordered by `sort_order`.

#### Scenario: Tour with attachments

- **WHEN** the tour has one or more attachments
- **THEN** the info sheet SHALL render a thumbnail strip with one entry per attachment

#### Scenario: Tour without attachments

- **WHEN** the tour has zero attachments
- **THEN** no attachments section SHALL be rendered

### Requirement: Open attachment in full-screen viewer

Tapping an attachment thumbnail in the info sheet SHALL open the full-screen viewer focused on that attachment, allowing horizontal flip between all attachments of the tour.

#### Scenario: Open viewer from thumbnail

- **WHEN** the user taps an attachment thumbnail
- **THEN** the full-screen viewer SHALL open with that attachment active AND the user SHALL be able to flip to the other attachments

### Requirement: Download attachment from viewer

The full-screen viewer SHALL expose a download control that saves the original file using its `original_filename`.

#### Scenario: User downloads

- **WHEN** the user taps the download control in the viewer
- **THEN** the browser SHALL save the file to the user's device using the original filename

### Requirement: Planned date renders as a span

The tour info view SHALL render a tour's planned date as a locale-formatted date **range**
when the tour has an end date, and as a single locale-formatted date when it does not. The
range SHALL be produced by the locale's own range formatting (`Intl.DateTimeFormat`
`formatRange`), not by concatenating two formatted dates with a hard-coded separator.

#### Scenario: Multi-day tour

- **WHEN** a tour has a planned date of 25 August 2026 and an end date of 27 August 2026
- **THEN** the info view SHALL show a single range label covering both dates, formatted per
  the active locale

#### Scenario: Single-day tour

- **WHEN** a tour has a planned date and no end date
- **THEN** the info view SHALL show exactly the single formatted date it showed before this
  capability existed

#### Scenario: Undated tour

- **WHEN** a tour has no planned date
- **THEN** no date label SHALL be rendered, regardless of the end date value

### Requirement: Legs at a glance

A split tour SHALL show its way-up activities after an up arrow and its way-down activities after
a down arrow in the detail and on stage cards, and its activity disc SHALL lead with the way up.
When the way down is flown, the end point SHALL read as the landing.

#### Scenario: Climb & fly detail

- **WHEN** a tour climbs up and flies down
- **THEN** the detail SHALL read "↑ Climbing ↓ Paragliding" and the end row SHALL be named "Landing"

### Requirement: Route numbers per leg

A split tour's route numbers SHALL count the climb on the way up only. When the whole way down is
flown, the descent SHALL be the flight's net drop, and a GPX track's distance SHALL be the way
up's alone. A flown way SHALL show its arrow and its activities' icons, the glider last — the
glider alone for a pure flight. A tour that ends at its goal SHALL show no descent.

#### Scenario: Hike & fly with a thermal

- **WHEN** a hike & fly track climbs 1000 m on foot and the flight circles 300 m up in a thermal
  before landing 1000 m below the summit
- **THEN** the route SHALL read "↑ 1000 m", a glider with 1000 m, and the walk's distance

#### Scenario: One way to a hut

- **WHEN** a stage ends at its goal
- **THEN** its route numbers SHALL show the climb and no "↓ 0 m"

#### Scenario: Ski down to a lower launch, then fly

- **WHEN** a ski & fly tour skis and flies the way down
- **THEN** its descent SHALL read with the arrow, the ski-tour icon and the glider

#### Scenario: An outing with a flown stage

- **WHEN** a two-day outing climbs on foot both days and flies down on the second
- **THEN** its totals SHALL read the climb plain and the descent with the glider
