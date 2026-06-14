## MODIFIED Requirements

### Requirement: Notify friend partners on shared-tour changes
When a tour involving a friend partner is created, meaningfully edited, or deleted, the system SHALL notify each friend partner on that tour except the actor. Dispatch SHALL reuse the existing client→Worker fire-and-forget pattern used for friend requests: after a successful write the client posts the tour id and action to the notification Worker, which resolves recipients and dispatches. Notification failures SHALL NOT block or roll back the tour write.

When an edit adds one or more new partners to an existing shared tour, the newly-added friend partners (those in `draft.partnerIds` but not in the prior `partnerIds`, intersected with the owner's friends) SHALL receive the new-shared-tour (`created`, "shared with you") notification rather than the generic edit (`updated`) notification. Pre-existing friend partners SHALL continue to receive the `updated` notification. A partner that is **removed** during an edit SHALL receive no notification (the Worker resolves recipients from the live tour row, so a removed partner is no longer a recipient).

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
- **THEN** B is notified the shared tour was removed

#### Scenario: Non-friend partners are not notified
- **WHEN** a tour has partner contacts that do not resolve to friends
- **THEN** those contacts receive no platform notification

#### Scenario: Notification failure does not fail the write
- **WHEN** the Worker dispatch call fails or times out
- **THEN** the tour create/edit/delete still succeeds and the error is logged, not surfaced as a write failure
