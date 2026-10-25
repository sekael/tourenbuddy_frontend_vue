## MODIFIED Requirements

### Requirement: Tour detail reads at a glance

The tour detail view SHALL open with a compact hero line led by the tour's goal: the activity badge, the goal elevation as the headline number, the planned date with the route numbers (climb, descent or flight, distance) beside it, the owner for friend tours, and the goal coordinates beneath; the tour name stays the sheet title. For the owner, the completion and visibility toggles SHALL stay a row of labelled buttons directly below the hero. Below the hero, facts SHALL render as dense icon-led rows without section headings and without per-fact cards, grouped by what belongs together and in this order: activity (type, seasons), route (start, end, GPX download), partners, free texts (description, equipment, notes), attachments, suggestions. A thin divider SHALL separate each group from the one above it, the hero and owner toggles counting as the first group; a group with nothing to show SHALL be omitted together with its divider. Start and end SHALL carry a short visible inline label ("Start", "End") because their icons alone are ambiguous; type, partners, seasons and the free texts SHALL be identified by their icon, and every row SHALL expose an accessible label. Rows for empty fields SHALL be omitted. The view SHALL be tinted with the tour's activity colour (the map marker colour): badge, row icons, season chips and partner avatars. A completed tour SHALL show a check stamp on the badge (and a "Completed" pill for friends viewing it); a private tour SHALL show a lock stamp. Partners SHALL render as avatar pills.

#### Scenario: Reading a tour on a phone

- **WHEN** the user opens a tour with an elevation, start point and description
- **THEN** the goal elevation is the most prominent number in the hero line, the start point is a single row labelled "Start" with its name and elevation, and the description is a row led by the description icon without a heading above it

#### Scenario: Activity type is a fact, not the headline

- **WHEN** the user opens a ski tour
- **THEN** the hero headline SHALL show the goal elevation, not the activity type
- **AND** "Ski Tour" SHALL appear as the first fact row with the ski-tour icon

#### Scenario: Owner toggles below the hero

- **WHEN** the owner opens their tour
- **THEN** completion and visibility SHALL be labelled toggle buttons in one row directly below the hero, each exposing a pressed state
- **AND** the hero line SHALL hold only the headline

#### Scenario: Long date range on a narrow phone

- **WHEN** a multi-day tour spanning two months is opened on a 360 px wide screen by its owner
- **THEN** the hero SHALL keep the badge and goal elevation on its first line
- **AND** the date range SHALL appear on the second line with abbreviated month names, together with the goal coordinates, wrapping there if needed

#### Scenario: Friend tour hero

- **WHEN** a user opens a friend's tour
- **THEN** no owner toggles SHALL be shown and the hero SHALL show the owner on a line beneath the date and coordinates

#### Scenario: Goal without elevation

- **WHEN** a tour's goal has no elevation
- **THEN** the hero line SHALL show no elevation number and no placeholder; the planned date SHALL move up to the first line, with the coordinates on the second line
- **AND** when there is no planned date either, the hero SHALL show the badge and the coordinates only

#### Scenario: Minimal tour stays short

- **WHEN** a tour has only a goal and an activity type
- **THEN** the view SHALL show the hero line, one divider and the type row only, with no empty headings, groups or gaps

#### Scenario: Related facts are grouped

- **WHEN** the user opens a tour with seasons, a start point, a GPX track, partners and notes
- **THEN** the seasons SHALL sit with the activity type, the GPX download with start and end, and the notes with the other free texts
- **AND** a divider SHALL separate each of these groups, and the partners, from the one above

#### Scenario: Route numbers in the opening height

- **WHEN** the user opens a hike & fly tour on a phone and the sheet rests at its opening height
- **THEN** the climb and the flight SHALL read in the hero beside the date, not in a fact row further down
