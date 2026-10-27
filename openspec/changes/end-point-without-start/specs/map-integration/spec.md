## MODIFIED Requirements

### Requirement: Start and end markers shown only while viewing or editing a tour's details

The map SHALL render a tour's **start** and **end** point markers ONLY while that tour's details are being viewed or edited (its info sheet is open, i.e. it is the selected tour) OR while a tour is being created. An open outing overview shows its segments' loose ends and handover rings instead (gpx-tracks → Outing overview start and end markers, Outing handover points). The standard map view, with no tour selected, no outing overview open and no tour being created, SHALL NOT show any start or end markers. Start/end markers SHALL NOT participate in clustering, collision suppression, or the goal-marker click/selection behavior. Start/end markers SHALL be display-only (non-interactive): a tap on a start or end marker SHALL be swallowed — it SHALL NOT select a tour, fly to it, NOR dismiss the open info sheet or cancel an in-progress tour creation. The same start/end markers SHALL be shown for a partner friend tour's details exactly as for an owned tour, with no friend-specific icon on the start or end marker.

Start/end markers SHALL reuse the goal marker's GL rendering mechanism: a circle in the tour's type-based color with a sibling symbol layer carrying the icon, kept on a selection-scoped source separate from the clustering source, and rendered beneath the goal marker so the goal stays on top when they overlap.

A start/end marker SHALL reuse the goal marker's circle design and the tour's type-based color, distinguished by a centered white icon: the **start** marker SHALL carry the start icon and the **end** marker SHALL carry the end icon, matching the icons the tour info sheet uses for those points (the ring `trip_origin` for start, the chequered flag `sports_score` for end; see tour-info-extended → Point icons match the form). The completion check glyph SHALL remain on the goal marker only — completing a tour SHALL NOT change its start or end markers.

The **start** marker SHALL be shown whenever the tour has a start point. The **end** marker SHALL be shown whenever the tour has an end point, unless it is the same place as the start point (within 10 m). A round-trip tour (end point in the same place as the start point, within 10 m) and a one-way-to-goal tour (no end point) SHALL therefore show a start marker and no end marker, mirroring the info sheet's treatment. A tour with an end point but no start point (a stage connected to the next one) SHALL show the end marker alone.

When the tour's details are closed (deselected) the start/end markers SHALL be removed. On a map style switch the start/end markers SHALL be re-rendered for the still-selected tour, the same as the goal and GPX layers.

#### Scenario: Start and end markers appear when a tour's details open

- **WHEN** a tour with a start point and a distinct end point becomes the selected tour and its info sheet opens
- **THEN** a start marker SHALL render at the start point and an end marker at the end point, both in the tour's type-based color with the start/end icons respectively
- **AND** the goal marker SHALL continue to render as before

#### Scenario: No start/end markers on the standard map

- **WHEN** no tour is selected, no outing overview is open and no tour is being created
- **THEN** no start or end markers SHALL be rendered anywhere on the map
- **AND** clustering and collision behavior SHALL be computed from goal markers only

#### Scenario: Round-trip tour shows start only

- **WHEN** the selected tour's end point is the same place as its start point (within 10 m)
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: One-way-to-goal tour shows start only

- **WHEN** the selected tour has a start point but no end point
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: End without a start shows the end marker alone

- **WHEN** the selected tour has an end point but no start point
- **THEN** an end marker SHALL render at the end point and NO start marker SHALL render

#### Scenario: Friend tour shows identical start/end markers

- **WHEN** a partner friend tour's details are open
- **THEN** its start/end markers SHALL render with the same design as an owned tour's, with no additional friend icon on the start or end marker

#### Scenario: Completion does not change start/end markers

- **WHEN** the selected tour is completed
- **THEN** the check glyph SHALL appear only on the goal marker
- **AND** the start and end markers SHALL render unchanged

#### Scenario: Tapping a start/end marker is swallowed, not dismissed

- **WHEN** the user taps a start or end marker while a tour's info sheet is open
- **THEN** no selection or fly-to SHALL occur (the goal marker remains the only selectable handle)
- **AND** the info sheet SHALL NOT close (the tap SHALL NOT be treated as a map-background click)

#### Scenario: Tapping a draft start/end marker does not cancel creation

- **WHEN** the user taps a start or end draft marker while creating a tour
- **THEN** the tour creation flow SHALL NOT be canceled

#### Scenario: Start/end markers removed on deselect

- **WHEN** the selected tour is deselected / its info sheet closes
- **THEN** the start and end markers SHALL be removed from the map

#### Scenario: Start/end markers survive a style switch

- **WHEN** the map base style is switched while a tour's details are open
- **THEN** the start and end markers SHALL be re-rendered for the still-selected tour after the new style loads
