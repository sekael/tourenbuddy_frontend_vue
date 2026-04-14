## ADDED Requirements

### Requirement: Tour type display

The tour info sheet SHALL display the tour type with an appropriate icon and human-readable label.

#### Scenario: Tour with type set

- **WHEN** the info sheet is shown for a tour with `tourType` set
- **THEN** it SHALL display an activity icon and the formatted type label (e.g., "Ski Tour / Splitboarding")

#### Scenario: Tour without type

- **WHEN** the info sheet is shown for a tour with null `tourType`
- **THEN** no tour type row SHALL be displayed

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

The tour info sheet SHALL display start and end points with route icons.

#### Scenario: Start and end points set

- **WHEN** the tour has both start and end points
- **THEN** they SHALL be displayed as two coordinate rows with `trip_origin` and `flag` icons

#### Scenario: Only start point (round trip)

- **WHEN** the tour has a start point but null end point
- **THEN** it SHALL display the start point with a "Round trip" indicator

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
