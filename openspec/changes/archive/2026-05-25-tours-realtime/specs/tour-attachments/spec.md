## ADDED Requirements

### Requirement: Tour attachments list reacts to Realtime changes

When the user has a tour-attachments view open and an attachment for that tour is inserted, updated, or deleted on another device, the local view SHALL reflect the change within one debounce window without a manual reload.

The subscription MAY be served by the same per-user Realtime channel that the tours store uses (binding for `tour_attachments` filtered by `user_id=eq.${uid}`), with the attachments store reacting to the same `onChange` debounced trigger via a refetch of the currently displayed tour's attachments.

#### Scenario: New attachment on device A appears on device B
- **WHEN** device A uploads an attachment for tour T and device B has tour T's attachment view open
- **THEN** the attachment appears on device B without a manual reload

#### Scenario: Attachment deletion on device A removes it on device B
- **WHEN** device A deletes an attachment for tour T
- **THEN** device B removes it from its open view of tour T

#### Scenario: Attachments for other tours don't trigger refetch
- **WHEN** an event arrives for an attachment whose `tour_id` is not the currently viewed tour
- **THEN** the attachments store does not perform a per-tour refetch (cost-bounded)
