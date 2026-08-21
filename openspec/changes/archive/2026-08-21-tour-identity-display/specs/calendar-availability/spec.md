## MODIFIED Requirements

### Requirement: Friend rows expose call and message actions from a contact

Friend availability rows SHALL resolve the friend's display name through the same shared
resolver used by every other tour-related surface — the viewer's saved contact name for
that user — rather than per-component resolution logic. Where no contact resolves, a
generic "a friend" fallback SHALL be shown. The call and message actions SHALL continue to
operate on the resolved contact, and SHALL be unavailable when no contact resolves.

#### Scenario: Availability chip names a friend by contact name

- **WHEN** a friend's availability chip renders for a friend saved under a different name
  than their profile name
- **THEN** the chip shows the contact name

#### Scenario: Unresolvable friend on an availability chip

- **WHEN** a friend's availability chip renders and no contact resolves for that user
- **THEN** the chip shows the generic "a friend" fallback, and the call and message actions
  are not offered for that row
