## ADDED Requirements

### Requirement: Tour rows are identified by activity type

Each tour row in the tour list SHALL lead with an avatar showing the tour's activity
type — the type's icon, tinted with the type's color from the same shared maps used by
the calendar and the map markers — instead of a letter derived from the tour's name. A
tour with no activity type SHALL render a generic tour icon on the list's neutral accent,
and SHALL NOT fall back to a letter or to a placeholder character. The avatar SHALL keep
its existing size, shape, and friend-tour badge overlay.

#### Scenario: Typed tour shows its activity icon

- **WHEN** a tour row renders for a tour whose activity type is set
- **THEN** the avatar shows that type's icon in that type's color, and no letter is rendered

#### Scenario: Untyped tour

- **WHEN** a tour row renders for a tour whose activity type is null
- **THEN** the avatar shows the generic tour icon on the neutral accent, and SHALL NOT
  render `?` or any character from the tour name

#### Scenario: Unnamed, untyped tour

- **WHEN** a tour row renders for a tour with neither a name nor an activity type
- **THEN** the row shows the "Unnamed tour" title beside the generic tour avatar, with no
  literal `?` anywhere in the row

#### Scenario: Friend badge remains legible over a tinted avatar

- **WHEN** a friend tour's row renders with a strongly tinted activity avatar
- **THEN** the friend badge remains visible against it, in the same corner position it
  occupies today
