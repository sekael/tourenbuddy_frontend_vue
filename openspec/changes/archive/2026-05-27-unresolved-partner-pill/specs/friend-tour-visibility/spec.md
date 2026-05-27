## ADDED Requirements

### Requirement: Unresolved partner count for partner viewers

The friend-read view SHALL expose, to partner-viewers only, an `unresolved_partner_count`: the number of distinct partner **contacts** on the tour that do NOT resolve to a confirmed-phone registered user (the same resolution chain used for partner names: `tour_partners → contact_methods phone → confirmed registered user`). The count SHALL be 0 for non-partner viewers and SHALL never reveal any identity (name, contact, or phone) of the unresolved partners. The count SHALL be computed by a tour-scoped resolver guarded identically to the partner-name resolver (the tour is `friends`-visible, the caller is a marked partner, and a friendship with the owner exists); the resolver SHALL return 0 when that guard fails.

The tour info sheet SHALL render a single generic pill reading "and X more" (pluralized, localized) alongside the named partner chips when, and only when, the count is at least 1. The pill SHALL appear for partner-viewers of a friend tour; it SHALL NOT appear on the owner's own view of a tour, nor for non-partner friends.

#### Scenario: Partner viewer sees count of unresolvable partners

- **WHEN** a partner-friend reads a friends-visible tour whose partners include 3 registered users and 2 contacts that resolve to no confirmed-phone user
- **THEN** the row returns the 3 names and `unresolved_partner_count = 2`

#### Scenario: Generic pill rendered for the unresolved count

- **WHEN** the partner-friend opens that tour's info sheet
- **THEN** the 3 partner names render as chips and a single pill "and 2 more" is shown

#### Scenario: No pill when all partners resolve

- **WHEN** a partner-friend reads a tour where every partner contact resolves to a confirmed-phone user
- **THEN** `unresolved_partner_count = 0` and no "and X more" pill is rendered

#### Scenario: Non-partner friend never receives the count

- **WHEN** a non-partner friend reads a friends-visible tour with unresolvable partner contacts
- **THEN** `unresolved_partner_count = 0` and no partner information (names or pill) is shown

#### Scenario: Owner view never shows the pill

- **WHEN** the owner views their own tour
- **THEN** partners render from the owner's address book and no "and X more" pill is shown

#### Scenario: Count is identity-free

- **WHEN** the unresolved count is exposed to a partner-viewer
- **THEN** the response contains only an integer count, never the name, contact id, or phone of any unresolved partner
