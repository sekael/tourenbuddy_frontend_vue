## ADDED Requirements

### Requirement: Worker collision scan after tour save
The notification Worker SHALL expose an authenticated endpoint that, given a saved tour id and the caller's JWT, scans for friend-owned tours satisfying the shared collision predicate (within 100 m, equal non-null `tour_type`, both friends-visible, mutual accepted friendship) and dispatches a `tour_interest` notification to each colliding owner. The endpoint SHALL replace the legacy decline-triggered `tour_interest` flow. The endpoint SHALL honor each recipient's `notif_push_enabled`, `notif_email_enabled`, and `notif_muted_types`. Failures SHALL return error responses but SHALL NOT block or roll back the tour write that preceded the call.

#### Scenario: Save with friend-owned colliding tour
- **WHEN** A's client posts the saved tour id and a friend B owns a tour that matches the collision predicate
- **THEN** the Worker dispatches a `tour_interest` notification to B naming A and identifying the colliding tour

#### Scenario: Save with no collisions
- **WHEN** A's client posts the saved tour id and no friend-owned tour matches the predicate
- **THEN** the Worker dispatches no notifications and returns a success response with a zero recipient count

#### Scenario: Invalid caller
- **WHEN** the caller's JWT subject does not match the saved tour's `user_id`
- **THEN** the Worker responds 403 and dispatches nothing

### Requirement: Worker friendship-accept backfill digest
The Worker SHALL emit a `tour_interest` friendship-accept backfill digest via an independent sub-routine within the existing `/notify/friend-request-responded` handler. When that endpoint runs and the response was an accept, the handler SHALL invoke two sub-routines in sequence, each wrapped in independent try/catch so failure of one does not block the other: (a) the existing `dispatchRespondedNotification`; (b) `dispatchBackfillDigest`, which scans for collisions between the two users' tours under the shared collision predicate, excludes pairs already in the same `tour_link_group` or with a pending `tour_link_request`, and dispatches a single `tour_interest` digest notification per side. The digest payload SHALL include `{friendshipId, collisionCount, appUrl}` and SHALL deep-link to the backfill collisions list page; tour names and full pair lists SHALL be fetched by the page on open rather than carried in the payload.

#### Scenario: Accept produces collisions on both sides
- **WHEN** friendship X↔Y transitions to accepted and the scan finds at least one not-yet-linked, no-pending-request collision
- **THEN** the Worker dispatches exactly one digest notification to X and exactly one to Y

#### Scenario: Accept produces no collisions
- **WHEN** the scan finds no eligible collisions
- **THEN** no digest notification is dispatched

#### Scenario: Recipient muted tour_interest
- **WHEN** X has `tour_interest` in `notif_muted_types`
- **THEN** no digest notification is dispatched to X even if collisions exist

### Requirement: Worker link-request lifecycle notifications
The Worker SHALL accept fire-and-forget calls to dispatch `tour_interest` notifications for link-request lifecycle events: created (notify target owner), accepted/declined (notify initiator owner), withdrawn (no notification). The Worker SHALL authorize each call by verifying the caller's JWT identifies the actor for the event (initiator for create/withdraw, target for accept/decline). Failures SHALL NOT block or roll back the underlying DB write.

#### Scenario: Link request created
- **WHEN** A's client posts a created event for a request from A's tour to B's tour
- **THEN** B receives a `tour_interest` notification naming A and the colliding tour

#### Scenario: Link request accepted
- **WHEN** B's client posts an accepted event for a request from A's tour to B's tour
- **THEN** A receives a `tour_interest` notification stating the request was accepted

#### Scenario: Link request declined
- **WHEN** B's client posts a declined event for a request from A's tour to B's tour
- **THEN** A receives a `tour_interest` notification stating the request was declined

#### Scenario: Caller does not match the event actor
- **WHEN** a call posts an accepted event but the caller's JWT does not match the target tour's owner
- **THEN** the Worker responds 403 and dispatches nothing

## MODIFIED Requirements

### Requirement: Meaningful-edit filtering
The system SHALL emit edit notifications only when a partner-facing field changes. The partner-facing set is: name, planned date, goal location, tour type, partners, completion flip, GPX track added/changed, description, and equipment. Changes confined to other fields (notes, elevation, seasons, start/end-point detail) SHALL NOT trigger a notification. Toggling visibility to `private` SHALL NOT emit an edit notification (the tour simply stops being visible to friends). Independently of `tour_updates`, any successful create or update of a tour SHALL trigger the Worker collision scan defined above; that scan dispatches under the separate `tour_interest` type and is not subject to the meaningful-edit filter.

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
- **THEN** no `tour_updates` edit notification is dispatched and the tour ceases to be visible to friends

#### Scenario: Collision scan runs regardless of meaningful-edit filter
- **WHEN** any tour create or update succeeds
- **THEN** the Worker collision scan runs and may dispatch `tour_interest` notifications independently of whether `tour_updates` is suppressed
