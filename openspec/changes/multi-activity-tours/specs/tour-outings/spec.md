## ADDED Requirements

### Requirement: Outing membership on tours

A tour SHALL optionally belong to an outing through three fields on its row: `outing_id`
(uuid), `outing_name` (text, shorter than 100 characters) and `outing_position` (integer).
`outing_id` and `outing_position` SHALL be set together or not at all, and `outing_name` SHALL
be null when `outing_id` is null. The domain `Tour` SHALL carry `outing: { id, name, position }`
or null.

#### Scenario: Invalid membership rejected

- **WHEN** a write sets `outing_id` without `outing_position`, or a name without an id
- **THEN** the database SHALL reject it with a check violation

### Requirement: Outing identity and order

Segments of an outing SHALL be ordered by position, then by tour id. An outing SHALL be
identified by its owner and its id together, and SHALL be presented as an outing only while at
least two of its segments are visible to the viewer; otherwise each segment presents as a plain
tour. The outing's display name SHALL be its stored name, falling back to the first segment's
name.

#### Scenario: Segments sorted by position

- **WHEN** an outing's segments have positions 2, 0 and 5
- **THEN** they SHALL be listed and numbered 1, 2, 3 in the order 0, 2, 5

#### Scenario: Copied outing id stays separate

- **WHEN** a user's tour carries the same `outing_id` as a friend's outing
- **THEN** the user's tour SHALL NOT appear as a segment of the friend's outing

#### Scenario: Single visible segment

- **WHEN** a viewer can see only one segment of an outing
- **THEN** that segment SHALL present as a plain tour (no outing row, no navigator, no badge)

### Requirement: Outing writes ride the tour write

`create_tour_full` and `update_tour_full` SHALL accept a trailing `p_outing jsonb` argument:
null keeps the tour's current membership on update and creates a standalone tour on create;
`{}` makes the tour standalone; `{"id", "name", "position"}` makes it that outing's segment.
Outing membership, name and position changes SHALL NOT count as meaningful tour changes for
partner notifications. Offline, an outing edit SHALL queue, coalesce and replay as the tour's
own update.

#### Scenario: Stale client keeps membership

- **WHEN** a client that predates outings saves a segment (no `p_outing` argument)
- **THEN** the tour SHALL stay in its outing with its name and position unchanged

#### Scenario: Leaving an outing

- **WHEN** a client saves a segment with `p_outing = {}`
- **THEN** the tour's outing fields SHALL all be null

#### Scenario: Outing edit does not notify partners

- **WHEN** the owner renames an outing or reorders its segments
- **THEN** no partner notification SHALL be recorded for the touched tours

#### Scenario: Offline rename

- **WHEN** the owner renames an outing while offline
- **THEN** each segment's update SHALL be queued and the new name SHALL show immediately, and
  the writes SHALL replay on reconnect

### Requirement: Add a segment

The owner SHALL be able to add a segment from a tour's detail and from the outing overview.
Adding SHALL offer two paths in the same sheet: pick a new goal on the map, or choose one of the
owner's standalone tours. A segment SHALL be appended after the last position. When the anchor
tour is not yet in an outing, the outing SHALL be created only when the new segment is saved
(the anchor joins first as segment 1), so cancelling leaves no outing behind.

#### Scenario: First segment added to a standalone tour

- **WHEN** the owner adds a segment to a standalone tour "Cabane de Bertol" and saves the new tour
- **THEN** both tours SHALL form an outing, "Cabane de Bertol" as segment 1 and the new tour as segment 2

#### Scenario: Cancelled new segment

- **WHEN** the owner starts adding a segment to a standalone tour and cancels the form
- **THEN** the tour SHALL remain standalone

#### Scenario: Existing tour added

- **WHEN** the owner chooses an existing standalone tour in the add-segment view
- **THEN** that tour SHALL become the outing's last segment

### Requirement: New segment form is seeded from the previous segment

A new segment's form SHALL be seeded from the outing's last segment: same activity types,
partners, visibility and seasons; planned date = that segment's last day; start point = its end
point, else its goal, with name and elevation.

#### Scenario: Seeded from the previous segment

- **WHEN** the previous segment ends at "Cabane de Bertol" (2311 m) on 12 March with types ski tour
- **THEN** the new segment's form SHALL open with start "Cabane de Bertol", 2311 m, planned date
  12 March and type ski tour

### Requirement: Outing overview

Selecting an outing (a segment's map marker, or its list row) SHALL open an overview sheet
titled with the outing's display name, showing its date span, its segment count and a numbered
timeline of its segments (name, activity, date, elevation). Tapping a segment SHALL open that
segment's tour detail; back from there SHALL return to the overview.

#### Scenario: Marker opens the overview

- **WHEN** a user taps the marker of a segment of a three-segment outing
- **THEN** the overview SHALL open and the map SHALL frame all three segments

#### Scenario: Segment from the overview

- **WHEN** the user taps segment 2 in the overview and then goes back
- **THEN** segment 2's detail SHALL open, and back SHALL return to the overview

### Requirement: Manage an outing

The owner SHALL be able to rename the outing, move segments up and down, remove a segment and
add a segment from the overview. Removing a segment that would leave a single one SHALL dissolve
the outing. A friend's outing SHALL be read-only.

#### Scenario: Reorder

- **WHEN** the owner moves segment 3 up
- **THEN** it SHALL become segment 2 and the former segment 2 SHALL become segment 3

#### Scenario: Removing from a two-segment outing

- **WHEN** the owner removes one segment of a two-segment outing
- **THEN** both tours SHALL become standalone and the overview SHALL close

#### Scenario: Friend's outing is read-only

- **WHEN** a user opens the overview of a friend's outing
- **THEN** no rename, reorder, remove or add control SHALL show

### Requirement: Segment navigator in tour detail

The tour detail of a segment SHALL show a navigator with the outing's display name, "segment n
of m" and previous / next controls. The name SHALL open the overview; previous / next SHALL
select the neighbouring segment and SHALL be disabled at the ends.

#### Scenario: Next segment

- **WHEN** the detail of segment 2 of 3 is open and the user taps next
- **THEN** segment 3's detail SHALL open

#### Scenario: Last segment

- **WHEN** the detail of the last segment is open
- **THEN** the next control SHALL be disabled

### Requirement: Outing focus on the map

While an outing's overview is open, the map SHALL draw every visible segment's goal marker
unclustered, with a white ring and a badge carrying its number. An open segment SHALL show as a
plain selected tour: only its own markers, track or connector. Opening the overview SHALL frame
the goals, starts and ends of all segments beside the sheet.

#### Scenario: Segments stay apart when zoomed out

- **WHEN** two segments of the focused outing are close enough to cluster at the current zoom
- **THEN** both SHALL still render as individual numbered markers

### Requirement: Outing tracks on the map

While an outing's overview is open, the map SHALL draw the GPX track (or connector) of every
segment. A track that finishes loading after the selection moved on SHALL NOT be drawn.

#### Scenario: Tracks in segment view

- **WHEN** segment 2 of an outing whose segments all have tracks is open
- **THEN** only segment 2's track SHALL be drawn

#### Scenario: Stale track load

- **WHEN** a track is still loading and the user selects another tour
- **THEN** the late track SHALL NOT replace the new selection's tracks

### Requirement: Outing rows in the tour list

The tour list SHALL show one row per outing in place of its segments, on both tabs. The row
SHALL appear when any segment passes the search and the active filters, at the position of the
first passing segment, and SHALL show the outing's display name, its segment count and date
span, and an avatar split between the segments' colours. Search SHALL also match the outing's
name. Tapping the row SHALL open the overview.

#### Scenario: Filter hits one segment

- **WHEN** the activity filter holds `paragliding` and only the second segment of an outing is a
  paragliding tour
- **THEN** the outing's row SHALL be listed

#### Scenario: Search by outing name

- **WHEN** the user searches "haute" and an outing is named "Haute Route" while none of its
  segments' names contain it
- **THEN** the outing's row SHALL be listed
