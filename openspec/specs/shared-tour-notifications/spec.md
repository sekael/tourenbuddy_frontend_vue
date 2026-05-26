# shared-tour-notifications Specification

## Purpose
TBD - created by archiving change friend-tour-visibility. Update Purpose after archive.
## Requirements
### Requirement: Notify friend partners on shared-tour changes
When a tour involving a friend partner is created, meaningfully edited, or deleted, the system SHALL notify each friend partner on that tour except the actor. Dispatch SHALL reuse the existing client→Worker fire-and-forget pattern used for friend requests: after a successful write the client posts the tour id and action to the notification Worker, which resolves recipients and dispatches. Notification failures SHALL NOT block or roll back the tour write.

#### Scenario: Friend partner notified of a new shared tour
- **WHEN** owner A creates a tour with friend B as a marked partner
- **THEN** B is notified of the new shared tour and A (the actor) is not

#### Scenario: Friend partner notified of an edit
- **WHEN** owner A edits a meaningful field of a tour on which B is a partner
- **THEN** B is notified of the change

#### Scenario: Friend partner notified of a deletion
- **WHEN** owner A deletes a tour on which B is a partner
- **THEN** B is notified the shared tour was removed

#### Scenario: Non-friend partners are not notified
- **WHEN** a tour has partner contacts that do not resolve to friends
- **THEN** those contacts receive no platform notification

#### Scenario: Notification failure does not fail the write
- **WHEN** the Worker dispatch call fails or times out
- **THEN** the tour create/edit/delete still succeeds and the error is logged, not surfaced as a write failure

### Requirement: Shared-tour notification preference and channels
Shared-tour notifications SHALL be dispatched under the `tour_updates` notification type and SHALL honor each recipient's `notif_push_enabled`, `notif_email_enabled`, and `notif_muted_types`. Email SHALL use a single generic Brevo template, localized per recipient locale.

#### Scenario: Recipient muted the type
- **WHEN** a recipient has `tour_updates` in `notif_muted_types`
- **THEN** no push or email is sent to that recipient regardless of channel state

#### Scenario: Channel preference respected
- **WHEN** a recipient has email enabled and push disabled
- **THEN** only the email notification is dispatched

#### Scenario: Single template for all actions
- **WHEN** any shared-tour change (created, edited, deleted) is emailed
- **THEN** the same generic Brevo template is used, parameterized by action and actor

### Requirement: Meaningful-edit filtering
The system SHALL emit edit notifications only when a partner-facing field changes. The partner-facing set is: name, planned date, goal location, tour type, partners, completion flip, GPX track added/changed, description, and equipment. Changes confined to other fields (notes, elevation, seasons, start/end-point detail) SHALL NOT trigger a notification. Toggling visibility to `private` SHALL NOT emit an edit notification (the tour simply stops being visible to friends).

#### Scenario: Meaningful field changed
- **WHEN** the planned date, equipment, or description of a shared tour changes
- **THEN** an edit notification is dispatched to friend partners

#### Scenario: Completion or GPX change notifies
- **WHEN** a shared tour is marked completed or a GPX track is added
- **THEN** an edit notification is dispatched to friend partners

#### Scenario: Non-meaningful change suppressed
- **WHEN** only notes/elevation/seasons/start-end detail change and no partner-facing field differs
- **THEN** no edit notification is dispatched

#### Scenario: Going private does not notify
- **WHEN** the owner switches a tour from friends to private
- **THEN** no edit notification is dispatched and the tour ceases to be visible to friends

