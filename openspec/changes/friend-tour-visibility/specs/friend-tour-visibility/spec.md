## ADDED Requirements

### Requirement: Per-tour visibility setting
Each tour SHALL carry a `visibility` value of either `private` or `friends`, defaulting to `friends` on creation. Only the tour owner SHALL be able to read or change a tour's visibility. The value SHALL be settable both at creation (tour form) and afterwards (tour info sheet).

#### Scenario: Default visibility on creation
- **WHEN** a tour is created without an explicit visibility
- **THEN** its `visibility` is persisted as `friends`

#### Scenario: Owner sets a tour private
- **WHEN** the owner toggles a tour to `private` in the form or info sheet
- **THEN** `visibility = 'private'` is persisted and the tour is no longer readable by any friend

#### Scenario: Non-owner cannot change visibility
- **WHEN** a user who is not the owner attempts to update a tour's visibility
- **THEN** the update is rejected by RLS and the value is unchanged

#### Scenario: Invalid visibility value rejected
- **WHEN** a write sets `visibility` to any value other than `private` or `friends`
- **THEN** the database check constraint rejects the write

### Requirement: Friend tour read authorization
A user SHALL be able to read a tour they do not own only when an accepted friendship exists between them and the owner AND the tour's `visibility` is `friends`. Owners SHALL always read their own tours regardless of visibility. Private tours SHALL be invisible to everyone except the owner, including marked partners.

#### Scenario: Friend reads a friends-visible tour
- **WHEN** user B, a friend of owner A, queries A's tour with `visibility = 'friends'`
- **THEN** the tour row is returned

#### Scenario: Private tour hidden from a partner friend
- **WHEN** user B is a marked partner on owner A's tour but the tour is `private`
- **THEN** the tour row is not returned to B

#### Scenario: Non-friend cannot read another user's tour
- **WHEN** user C, who has no friendship with owner A, queries A's `friends`-visible tour
- **THEN** no row is returned

#### Scenario: Friendship removed revokes access
- **WHEN** the friendship between A and B is removed
- **THEN** B can no longer read A's tours

### Requirement: Non-partner detail gating
When a friend who is NOT a marked partner on a tour reads it, the system SHALL withhold `partner_ids`, `planned_date`, and `gpx_filepath` (returned as null/empty). Partner status SHALL be derived live by resolving the tour's partner contacts to registered users (tour_partners → contacts → contact_methods phone → registered user), without a materialized link table. Owners and partner-friends SHALL receive the full, ungated tour.

#### Scenario: Non-partner friend sees gated fields
- **WHEN** friend B reads owner A's `friends`-visible tour on which B is not a partner
- **THEN** the returned row has `partner_ids` empty, `planned_date` null, and `gpx_filepath` null, while name/location/type remain visible

#### Scenario: Partner friend sees full detail
- **WHEN** friend B reads a tour on which B is a marked partner (B's verified phone matches a partner contact)
- **THEN** the returned row includes `partner_ids`, `planned_date`, and `gpx_filepath`

#### Scenario: Owner read is never gated
- **WHEN** owner A reads their own tour
- **THEN** all fields are returned regardless of partner resolution

#### Scenario: Partner contact phone removed downgrades detail
- **WHEN** the partner contact linking friend B to a tour loses its matching phone
- **THEN** B is no longer resolved as a partner and subsequent reads gate `partner_ids`, `planned_date`, and `gpx_filepath`

### Requirement: Partner representation for friend viewers
For a friend viewer, partners on a tour SHALL be represented as registered-user profile names (resolved from each partner contact's verified phone), never as the owner's raw contact IDs. The owner's non-registered address-book contacts SHALL NOT be exposed to friends. The owner's own view SHALL continue to render partners from their address book unchanged.

#### Scenario: Friend sees registered partners by name
- **WHEN** a partner-friend reads a tour whose partners include registered users and non-registered address-book contacts
- **THEN** only the registered users are returned, by profile name, and the non-registered contacts are omitted

#### Scenario: Owner view unchanged
- **WHEN** the owner views their own tour
- **THEN** partners render from the owner's address book exactly as before

### Requirement: GPX file access for partner friends
GPX track files SHALL be downloadable by a partner-friend of the owner when the tour is `friends`-visible, and SHALL remain blocked for non-partner friends and for private tours. Access SHALL be enforced at the storage layer (not only by gating the path in the read view).

#### Scenario: Partner friend downloads the GPX
- **WHEN** a partner-friend requests the GPX object of a friends-visible tour they are a partner on
- **THEN** the storage policy permits the download

#### Scenario: Non-partner friend blocked from GPX
- **WHEN** a non-partner friend requests the GPX object of a friends-visible tour
- **THEN** the storage policy denies the download

#### Scenario: Private tour GPX blocked
- **WHEN** any non-owner requests the GPX object of a private tour
- **THEN** the storage policy denies the download

### Requirement: Friend tours on the map
The map SHALL display, in addition to the user's own tours, friend tours on which the user is a marked partner. Such friend markers SHALL carry a friendship indicator within the marker, participate in clustering, and otherwise behave like owned-tour markers. Friend tours where the user is not a partner SHALL NOT appear on the map.

#### Scenario: Partner friend tour rendered with indicator
- **WHEN** the map loads and the user is a partner on a friend's `friends`-visible tour
- **THEN** the tour appears as a marker with a friendship indicator and is included in clustering

#### Scenario: Non-partner friend tour absent from map
- **WHEN** a friend has a `friends`-visible tour on which the user is not a partner
- **THEN** that tour does not appear on the map

### Requirement: Owned and friends list tabs
The tour list ("My Tours") SHALL default to owned tours and SHALL present two separate tabs — Owned and Friends — with no merged list. Search and filtering SHALL operate independently within each tab. The Friends tab SHALL list all friend tours the user is permitted to read, with non-partner tours shown in gated form.

#### Scenario: Default tab is owned
- **WHEN** the user opens the tour list
- **THEN** the Owned tab is active and shows only the user's own tours

#### Scenario: Friends tab lists gated and full friend tours
- **WHEN** the user switches to the Friends tab
- **THEN** partner friend tours show full detail and non-partner friend tours show gated fields, each labeled by owner

#### Scenario: Search scoped to active tab
- **WHEN** the user enters a search term while the Friends tab is active
- **THEN** only friend tours are filtered and owned tours are unaffected
