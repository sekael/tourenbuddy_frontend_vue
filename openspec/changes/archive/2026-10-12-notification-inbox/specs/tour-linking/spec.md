# Spec Delta

## MODIFIED Requirements

### Requirement: Tour save fires collision-detected notification
After the owner creates or meaningfully updates a friends-visible tour — whether or not it has partners — the system SHALL, in the same transaction, scan for friend-owned tours satisfying the collision predicate and emit a `tour_interest` notification to each colliding owner. Push/email delivery SHALL be best-effort: failures SHALL NOT block or roll back the tour write.

#### Scenario: New tour collides with a friend tour
- **WHEN** owner A saves a tour whose goal is within 200 m, with the same non-null `tour_type`, and with friends-visibility matching a friend B's tour also at friends-visibility
- **THEN** a `tour_interest` notification naming A as the friend who planned the same tour is emitted for B

#### Scenario: Solo tour without partners
- **WHEN** owner A creates a friends-visible tour with no partners that collides with friend B's tour
- **THEN** a `tour_interest` notification is emitted for B

#### Scenario: Owner muted the type
- **WHEN** B has `tour_interest` in `notif_muted_types`
- **THEN** no push or email is sent to B even though the scan finds the collision; B's inbox still records it

#### Scenario: No collision found
- **WHEN** the saved tour has no friend-owned collisions
- **THEN** no notification is emitted

#### Scenario: Worker dispatch failure does not fail the save
- **WHEN** push/email delivery for the emitted event fails
- **THEN** the tour write still succeeds and the failure is logged server-side

### Requirement: Group-membership-change notifications
When the membership of a `tour_link_group` changes, the system SHALL emit `tour_interest`-typed notifications in the same transaction as the membership change, including changes caused by cascades (tour edits, friendship removal), so participants stay informed. Push/email delivery SHALL honor each recipient's push registrations, `notif_email_enabled`, and `notif_muted_types`. Failures SHALL NOT block the underlying DB write.

#### Scenario: New member joins — pre-existing members notified
- **WHEN** C joins an existing group containing A and B via accepted link request
- **THEN** A and B each receive a `tour_interest` notification naming C and identifying the group; C is not notified (C is the actor)

#### Scenario: External eviction — evicted user and remaining members notified
- **WHEN** A's tour is evicted from a group because of a sibling member's edit, a friendship deletion involving A, or another non-self event
- **THEN** A receives a notification stating the tour was unlinked, and the remaining group members each receive a notification that A's tour is no longer in the group

#### Scenario: Self-eviction via own confirmed edit — only remaining members notified
- **WHEN** A confirms an edit-warning dialog that evicts A's own tour from a group
- **THEN** the remaining group members each receive a notification; A is not self-notified

#### Scenario: Dissolution — lone remaining member notified
- **WHEN** an eviction or cascade drops a group's member count below 2
- **THEN** the lone remaining member (if any) receives a notification that the group has dissolved

#### Scenario: Recipients resolved after cascade
- **WHEN** a friendship deletion cascades eviction and dissolution in one transaction
- **THEN** each affected member is notified once with the tour name as it was before the cascade
