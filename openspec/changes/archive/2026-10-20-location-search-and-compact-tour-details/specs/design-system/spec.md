# Spec Delta

## MODIFIED Requirements

### Requirement: Tour detail reads at a glance

The tour detail view SHALL open with a compact hero line led by the tour's goal: the activity badge, the goal elevation as the headline number, the planned date, the owner for friend tours, and the goal coordinates beneath; the tour name stays the sheet title. For the owner, the completion and visibility toggles SHALL stay a row of labelled buttons directly below the hero. Below the hero, facts SHALL render as dense icon-led rows without section headings and without per-fact cards, grouped by what belongs together and in this order: activity (type, seasons), route (start, end, GPX download), partners, free texts (description, equipment, notes), attachments, suggestions. A thin divider SHALL separate each group from the one above it, the hero and owner toggles counting as the first group; a group with nothing to show SHALL be omitted together with its divider. Start and end SHALL carry a short visible inline label ("Start", "End") because their icons alone are ambiguous; type, partners, seasons and the free texts SHALL be identified by their icon, and every row SHALL expose an accessible label. Rows for empty fields SHALL be omitted. The view SHALL be tinted with the tour's activity colour (the map marker colour): badge, row icons, season chips and partner avatars. A completed tour SHALL show a check stamp on the badge (and a "Completed" pill for friends viewing it); a private tour SHALL show a lock stamp. Partners SHALL render as avatar pills.

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

### Requirement: Material Symbols icon font

The system SHALL render icons as bundled SVGs (using the Material Symbols Outlined glyph set), tree-shaken at build time, with no dependency on an external font CDN. Where the Material set has no glyph for a needed subject, the app SHALL use its own SVG glyph instead of a loosely related Material one, drawn to the same grid and stroke weight and bundled the same way. Icons SHALL be rendered through a shared `Icon` component that exposes the glyph name and token-driven sizing, backed by a central icon registry that maps each icon name to its SVG. An icon's rendered box SHALL be independent of any text content, so that font-load state, network conditions, or a missing asset can never let icon markup affect the layout of a containing element.

#### Scenario: Icon renders via the component

- **WHEN** a component renders `<Icon name="map" />`
- **THEN** the map icon renders as an inline SVG vector with the standard size

#### Scenario: Icon sizing is token-driven

- **WHEN** an `Icon` is rendered at a given size
- **THEN** its dimensions derive from design tokens rather than per-instance literal font sizes

#### Scenario: Dynamically named icon resolves

- **WHEN** a component passes an icon name chosen at runtime (e.g. from the tour-type lookup or a prop)
- **THEN** the shared component resolves it through the icon registry and renders the corresponding SVG

#### Scenario: Fixed-position icon bar keeps its intrinsic width at app start

- **WHEN** the tour action-bar pill mounts at app start under any network condition (slow, offline, cold PWA)
- **THEN** the pill sizes to its content (label + fixed-size icon boxes) and does not span the full viewport width, because the SVG icons have no text content that could widen it

#### Scenario: Ski-touring types have their own glyphs

- **WHEN** a ski tour or a splitboard tour is shown anywhere the tour type icon appears (type picker, tour list, tour detail, calendar)
- **THEN** a ski tour SHALL show an uphill skier on skins and a splitboard tour a matching uphill splitboarder
- **AND** neither SHALL show the walking/hiking glyph
- **AND** both SHALL render offline, without any network request

#### Scenario: Equipment reads as gear by its icon

- **WHEN** a tour with equipment is shown in the detail view
- **THEN** the equipment row SHALL lead with an ice axe glyph, a subject the Material set lacks
- **AND** it SHALL NOT use a generic backpack, box or tools glyph

#### Scenario: Climbing and mountaineering types have their own glyphs

- **WHEN** a climbing, a mountaineering or a ski-mountaineering tour is shown anywhere the tour type icon appears
- **THEN** a climbing tour SHALL show a climber on a rock overhang, a mountaineering tour a figure scrambling up a rock step, and a ski-mountaineering tour that figure with skis strapped to its pack
- **AND** the three SHALL differ from each other and from the hiking and ski-touring glyphs, and none SHALL show a generic landscape or mountains glyph
