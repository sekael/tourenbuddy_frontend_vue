## ADDED Requirements

### Requirement: Notify the owner when suggestions are submitted

When a partner submits a batch of suggestions, the system SHALL notify the tour owner
once for the whole batch — not once per field — under the `tour_suggestions` notification
type. Dispatch SHALL reuse the existing client→Worker fire-and-forget pattern: after the
write succeeds the client posts the batch id to the notification Worker, which resolves
the recipient from the live suggestion rows. Notification failure SHALL NOT fail or roll
back the suggestion write. No other partner on the tour SHALL be notified.

Revising a pending batch SHALL NOT re-notify the owner, who has already been told the
batch exists and whose review surface updates live. A change made after a batch was fully
resolved forms a new batch and SHALL notify as a fresh submission.

#### Scenario: Owner notified once per batch
- **WHEN** a partner submits four field suggestions in one batch
- **THEN** the owner receives exactly one notification naming the tour and the suggester

#### Scenario: Other partners are not notified of a suggestion
- **WHEN** a partner submits suggestions on a tour with three other marked partners
- **THEN** none of the other partners receives a notification

#### Scenario: Revision is silent
- **WHEN** the author revises their still-pending batch
- **THEN** no notification is dispatched

#### Scenario: Post-resolution change notifies as a new submission
- **WHEN** the author proposes a change after their previous batch was fully resolved
- **THEN** a new batch is created and the owner is notified once for it

#### Scenario: Dispatch failure does not fail the write
- **WHEN** the Worker call fails or times out after the suggestions were created
- **THEN** the suggestions still exist and the error is logged, not surfaced as a write failure

### Requirement: Notify the author when their batch is fully resolved

The system SHALL notify a suggestion's author under the `tour_suggestions` type when their
batch transitions to having no `pending` rows left, summarizing how many were accepted and
how many declined. A partially-resolved batch SHALL dispatch nothing. Suggestions
auto-declined as a side effect of accepting a competing suggestion on the same field SHALL
run the same completion check. A batch emptied by its own author's withdrawals SHALL
dispatch nothing, and suggestions voided by a broken partner predicate SHALL dispatch
nothing.

#### Scenario: Author notified once when the batch completes
- **WHEN** the owner resolves the last pending row of a four-row batch, having accepted three and declined one
- **THEN** the author receives exactly one notification summarizing three accepted and one declined

#### Scenario: Partial resolution stays silent
- **WHEN** the owner accepts two rows of a four-row batch and stops
- **THEN** no notification is dispatched and the author sees the partial state in-app

#### Scenario: Auto-decline completing a batch notifies its author
- **WHEN** accepting one partner's suggestion auto-declines another partner's last pending row
- **THEN** that other partner is notified that their batch was declined

#### Scenario: Withdrawal is silent
- **WHEN** an author withdraws their own pending suggestions
- **THEN** no notification is dispatched to anyone

#### Scenario: Predicate-break void is silent
- **WHEN** pending suggestions are voided because the friendship was removed
- **THEN** no notification is dispatched

### Requirement: Accepted suggestions notify the other partners as a tour change

When an accepted suggestion changes a field in the meaningful-edit set, the system SHALL
dispatch the existing `tour_updates` notification to the tour's friend partners, excluding
the acting owner and excluding the suggestion's author, who receives the
`tour_suggestions` resolution notification instead. A batch acceptance SHALL dispatch at
most one such notification.

#### Scenario: Partners hear that the meeting point moved
- **WHEN** the owner accepts a suggestion that changes the goal location
- **THEN** the tour's other friend partners receive the shared-tour `updated` notification

#### Scenario: The author is not double-notified
- **WHEN** the owner accepts a partner's suggestion
- **THEN** that partner receives only the `tour_suggestions` resolution notification, not also the `tour_updates` one

#### Scenario: Cosmetic accepted field notifies nobody
- **WHEN** the owner accepts a suggestion changing only a field outside the meaningful-edit set
- **THEN** no `tour_updates` notification is dispatched

#### Scenario: Batch acceptance notifies once
- **WHEN** the owner accepts a batch changing three meaningful fields
- **THEN** the other partners receive one `tour_updates` notification, not three
