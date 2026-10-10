# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Worker collision scan after tour save`
- TO: `### Requirement: Collision scan after tour save`

- FROM: `### Requirement: Worker friendship-accept backfill digest`
- TO: `### Requirement: Friendship-accept backfill digest`

- FROM: `### Requirement: Worker link-request lifecycle notifications`
- TO: `### Requirement: Link-request lifecycle notifications`

## MODIFIED Requirements

### Requirement: Notify friend partners on shared-tour changes
When a tour involving a friend partner is created, meaningfully edited, or deleted, the system SHALL notify each friend partner on that tour except the actor. The event SHALL be emitted by the database in the same transaction as the tour write — never by a separate client call — so it is recorded whenever the write commits, including writes replayed from the offline queue. Push/email delivery is derived from the emitted event and SHALL NOT block or roll back the tour write.

When an edit adds one or more new partners to an existing shared tour, the newly-added friend partners (partners present after the edit but not before, intersected with the owner's friends) SHALL receive the new-shared-tour (`created`, "shared with you") notification rather than the generic edit (`updated`) notification. Pre-existing friend partners SHALL continue to receive the `updated` notification. A partner that is **removed** during an edit SHALL receive no notification.

#### Scenario: Friend partner notified of a new shared tour
- **WHEN** owner A creates a tour with friend B as a marked partner
- **THEN** B is notified of the new shared tour and A (the actor) is not

#### Scenario: Friend partner notified of an edit
- **WHEN** owner A edits a meaningful field of a tour on which B is a partner
- **THEN** B is notified of the change

#### Scenario: Newly-added partner greeted as a new shared tour
- **WHEN** owner A edits an existing shared tour and adds friend C as a new partner
- **THEN** C receives the new-shared-tour ("shared with you") notification, not the generic "updated" notification
- **AND** any pre-existing friend partner on that tour receives the "updated" notification

#### Scenario: Removed partner is not notified
- **WHEN** owner A edits a tour and removes friend D from the partner set
- **THEN** D receives no notification about the change

#### Scenario: Friend partner notified of a deletion
- **WHEN** owner A deletes a tour on which B is a partner
- **THEN** B is notified the shared tour was removed, naming the tour as it was before deletion

#### Scenario: Non-friend partners are not notified
- **WHEN** a tour has partner contacts that do not resolve to friends
- **THEN** those contacts receive no platform notification

#### Scenario: Notification failure does not fail the write
- **WHEN** recording the event or delivering push/email fails
- **THEN** the tour create/edit/delete still succeeds and the error is logged server-side, not surfaced as a write failure

#### Scenario: Offline edit replayed
- **WHEN** A edits a shared tour offline and the queued write replays on reconnect
- **THEN** B is notified exactly once, when the replayed write commits

### Requirement: Meaningful-edit filtering

The system SHALL emit edit notifications only when a partner-facing field changes. The partner-facing set is: name, planned date **span** (either endpoint — the planned start date or the end date), goal location, tour type, partners, completion flip, GPX track added/changed, description, equipment, seasons, and the start / end point (location or name). Changes confined to other fields (notes, tour elevation, start/end-point elevation) SHALL NOT trigger a notification. An accepted suggestion on any of these fields SHALL count the same way. Toggling visibility to `private` SHALL NOT emit an edit notification (the tour simply stops being visible to friends). This filter SHALL be evaluated by the database against the tour's state before and after the write. Independently of `tour_updates`, a create or a meaningful update of a friends-visible tour SHALL run the collision scan defined below; that scan emits under the separate `tour_interest` type. A completion or visibility flip alone SHALL NOT run the scan.

#### Scenario: Meaningful field changed
- **WHEN** the planned date, equipment, or description of a shared tour changes
- **THEN** an edit notification is emitted for friend partners

#### Scenario: Span length changed
- **WHEN** a shared tour's end date is added, removed, or moved while its planned start date is unchanged
- **THEN** an edit notification is emitted for friend partners

#### Scenario: Completion or GPX change notifies
- **WHEN** a shared tour is marked completed or a GPX track is added
- **THEN** an edit notification is emitted for friend partners

#### Scenario: Non-meaningful change suppressed
- **WHEN** only notes/elevation/seasons/start-end detail change and no partner-facing field differs
- **THEN** no edit notification is emitted

#### Scenario: Going private does not notify
- **WHEN** the owner switches a tour from friends to private
- **THEN** no `tour_updates` edit notification is emitted and the tour ceases to be visible to friends

#### Scenario: Collision scan runs regardless of meaningful-edit filter
- **WHEN** a friends-visible tour is created or meaningfully updated
- **THEN** the collision scan runs and may emit `tour_interest` notifications independently of whether `tour_updates` is emitted

#### Scenario: Completion flip does not rescan
- **WHEN** the only change is marking the tour completed
- **THEN** no collision scan runs

### Requirement: Collision scan after tour save
When a tour save qualifies for the collision scan, the system SHALL find friend-owned tours satisfying the shared collision predicate (within 200 m, equal non-null `tour_type`, both friends-visible, mutual accepted friendship) and emit a `tour_interest` notification to each colliding owner, in the same transaction as the save. The scan SHALL only run for saves by the tour's owner. Failures SHALL NOT block or roll back the tour write.

#### Scenario: Save with friend-owned colliding tour
- **WHEN** A saves a tour and a friend B owns a tour that matches the collision predicate
- **THEN** a `tour_interest` notification naming A and identifying the colliding tour is emitted for B

#### Scenario: Save with no collisions
- **WHEN** A saves a tour and no friend-owned tour matches the predicate
- **THEN** no `tour_interest` notification is emitted

#### Scenario: Invalid caller
- **WHEN** a user who does not own the tour attempts to save it
- **THEN** the write is rejected and no scan runs

### Requirement: Friendship-accept backfill digest
When a friendship transitions to accepted, the system SHALL, in the same transaction, scan for collisions between the two users' tours under the shared collision predicate, excluding pairs already in the same `tour_link_group` or with a pending `tour_link_request`, and emit a single `tour_interest` digest notification per side that has at least one collision. The digest SHALL carry the friendship and collision count and SHALL deep-link to the backfill collisions list; tour names and pair lists SHALL be fetched by that page on open. A failure of the digest SHALL NOT block the accept or the friend-request-responded notification.

#### Scenario: Accept produces collisions on both sides
- **WHEN** friendship X↔Y transitions to accepted and the scan finds at least one not-yet-linked, no-pending-request collision
- **THEN** exactly one digest notification is emitted for X and exactly one for Y

#### Scenario: Accept produces no collisions
- **WHEN** the scan finds no eligible collisions
- **THEN** no digest notification is emitted

#### Scenario: Recipient muted tour_interest
- **WHEN** X has `tour_interest` in `notif_muted_types`
- **THEN** no digest push or email is sent to X even if collisions exist, while X's inbox still records the digest

### Requirement: Link-request lifecycle notifications
The system SHALL emit `tour_interest` notifications for link-request lifecycle events in the same transaction as the request write: created (notify target owner), accepted/declined (notify initiator owner), withdrawn (no notification). Only the legitimate actor can perform each transition (initiator for create/withdraw, target for accept/decline), so a notification can only result from that actor's write. Failures SHALL NOT block or roll back the underlying DB write.

#### Scenario: Link request created
- **WHEN** A creates a request from A's tour to B's tour
- **THEN** B receives a `tour_interest` notification naming A and the colliding tour

#### Scenario: Link request accepted
- **WHEN** B accepts a request from A's tour to B's tour
- **THEN** A receives a `tour_interest` notification stating the request was accepted

#### Scenario: Link request declined
- **WHEN** B declines a request from A's tour to B's tour
- **THEN** A receives a `tour_interest` notification stating the request was declined

#### Scenario: Caller does not match the event actor
- **WHEN** a user who does not own the target tour attempts to accept the request
- **THEN** the write is rejected and no notification is emitted

### Requirement: Notify the owner when suggestions are submitted

When a partner submits a batch of suggestions, the system SHALL notify the tour owner
once for the whole batch — not once per field — under the `tour_suggestions` notification
type. The event SHALL be emitted by the database in the same transaction as the suggestion
write. Notification failure SHALL NOT fail or roll back the suggestion write. No other
partner on the tour SHALL be notified.

Revising a pending batch SHALL notify the owner once per submitted revision as a distinct
`suggestion_revised` event (not a fresh submission): a revision can arrive hours or days
later and changes what the owner is asked to review. A change made after a batch was fully
resolved forms a new batch and SHALL notify as a fresh submission.

#### Scenario: Owner notified once per batch
- **WHEN** a partner submits four field suggestions in one batch
- **THEN** the owner receives exactly one notification naming the tour and the suggester

#### Scenario: Other partners are not notified of a suggestion
- **WHEN** a partner submits suggestions on a tour with three other marked partners
- **THEN** none of the other partners receives a notification

#### Scenario: Revision notifies as revised
- **WHEN** the author revises and resubmits their still-pending batch
- **THEN** the owner receives one `suggestion_revised` notification and no second `suggestion_submitted`

#### Scenario: Post-resolution change notifies as a new submission
- **WHEN** the author proposes a change after their previous batch was fully resolved
- **THEN** a new batch is created and the owner is notified once for it

#### Scenario: Dispatch failure does not fail the write
- **WHEN** recording the event or delivering push/email fails after the suggestions were created
- **THEN** the suggestions still exist and the error is logged server-side, not surfaced as a write failure
