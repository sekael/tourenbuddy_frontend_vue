## ADDED Requirements

### Requirement: Friends are named by the viewer's contact name

Every tour-linking surface that names another user SHALL use the name under which the
viewer has saved that user in their own contacts: the collision notice, the linked-with
pills, the link-request banner, and the backfill collisions page. Everyone named on these
surfaces is a confirmed friend of the viewer and therefore resolves to a contact. Where no
contact resolves, a generic "a friend" fallback SHALL be shown; a user's own profile name
SHALL NOT be used as a fallback on these surfaces, and a tour-related string SHALL NEVER be
used as a person's name.

#### Scenario: Collision notice names a friend by contact name

- **WHEN** a collision notice lists a candidate whom the viewer has saved under a different
  name than that user's profile name
- **THEN** the contact name is shown

#### Scenario: No "Unnamed tour" as a person's name

- **WHEN** a candidate's name cannot be resolved on the collision notice
- **THEN** the generic "a friend" fallback is shown, and the tour-naming string
  "Unnamed tour" is never rendered as that person's name

#### Scenario: List surfaces resolve in one batch

- **WHEN** a surface names several users at once — collision candidates, linked tours, or
  backfill pairs
- **THEN** their names are resolved with a single batched lookup rather than one per user
