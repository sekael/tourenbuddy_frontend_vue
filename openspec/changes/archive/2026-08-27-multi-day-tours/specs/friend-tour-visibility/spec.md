## MODIFIED Requirements

### Requirement: Non-partner detail gating

The friend-read view SHALL never expose the owner's raw `partner_ids`. When a friend who is NOT a marked partner on a tour reads it, the system SHALL additionally withhold the partner **names**, `planned_date`, `end_date`, and `gpx_filepath` (returned as empty/null). Partner status SHALL be derived live by resolving the tour's partner contacts to registered users (tour_partners → contacts → contact_methods phone → registered user), without a materialized link table. Owners and partner-friends SHALL receive the full, ungated tour.

`end_date` SHALL be gated by exactly the same predicate as `planned_date`: a viewer who may not learn when a tour starts SHALL NOT learn how long it lasts.

#### Scenario: Non-partner friend sees gated fields
- **WHEN** friend B reads owner A's `friends`-visible tour on which B is not a partner
- **THEN** the returned row has empty partner names, `planned_date` null, `end_date` null, and `gpx_filepath` null, while name/location/type remain visible

#### Scenario: Partner friend sees full detail
- **WHEN** friend B reads a tour on which B is a marked partner (B's verified phone matches a partner contact)
- **THEN** the returned row includes the partner names, `planned_date`, `end_date`, and `gpx_filepath`

#### Scenario: Owner read is never gated
- **WHEN** owner A reads their own tour
- **THEN** all fields are returned regardless of partner resolution

#### Scenario: Partner contact phone removed downgrades detail
- **WHEN** the partner contact linking friend B to a tour loses its matching phone
- **THEN** B is no longer resolved as a partner and subsequent reads gate the partner names, `planned_date`, `end_date`, and `gpx_filepath`

### Requirement: Friend-tour broadcast carries no unauthorized data

The friend-tour broadcast SHALL be signal-only: it MUST NOT carry tour detail fields. Viewers SHALL obtain tour data by refetching through `friend_tours_view` and the friend-tour RPCs, so Layer-1 row visibility and Layer-2 non-partner detail gating (`planned_date` / `end_date` / `gpx_filepath` / partner names) are enforced by RLS on every datum. The mechanism MUST NOT leak the existence or detail of a tour the viewer is not authorized to read.

#### Scenario: Non-partner detail stays gated after a broadcast
- **WHEN** a non-partner friend receives a broadcast and refetches
- **THEN** `planned_date`, `end_date`, `gpx_filepath`, and raw partner identities remain nulled/reduced exactly as `friend_tours_view` already enforces

#### Scenario: Private tour never broadcasts
- **WHEN** owner A writes a tour whose visibility is and was not `friends` (e.g. private→private)
- **THEN** no friend-tour broadcast is emitted, and no viewer learns the tour exists

#### Scenario: Harmless poke to an unauthorized recipient
- **WHEN** a viewer receives a broadcast but is (by a race) no longer authorized to read the tour
- **THEN** the refetch through `friend_tours_view` returns nothing for that tour and no unauthorized data is exposed
