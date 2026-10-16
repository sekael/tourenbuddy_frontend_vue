# Spec Delta

## REMOVED Requirements

### Requirement: Meaningful-edit filtering

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "Edit notifications only for partner-facing changes", "Planned date span counts at either endpoint", "Non-partner-facing changes do not notify", "Going private does not emit an edit notification", "Collision scan runs on create or meaningful update".

## ADDED Requirements

### Requirement: Edit notifications only for partner-facing changes

The system SHALL emit edit notifications only when a partner-facing field changes. The partner-facing set is: name, planned date **span**, goal location, tour type, partners, completion flip, GPX track added/changed, description, equipment, seasons, and the start / end point (location or name). An accepted suggestion on any of these fields SHALL count the same way. This filter SHALL be evaluated by the database against the tour's state before and after the write.

#### Scenario: Meaningful field changed
- **WHEN** the planned date, equipment, or description of a shared tour changes
- **THEN** an edit notification is emitted for friend partners

#### Scenario: Completion or GPX change notifies
- **WHEN** a shared tour is marked completed or a GPX track is added
- **THEN** an edit notification is emitted for friend partners

### Requirement: Planned date span counts at either endpoint

A change to either endpoint of the planned date **span** — the planned start date or the end date — SHALL count as a partner-facing change.

#### Scenario: Span length changed
- **WHEN** a shared tour's end date is added, removed, or moved while its planned start date is unchanged
- **THEN** an edit notification is emitted for friend partners

### Requirement: Non-partner-facing changes do not notify

Changes confined to fields outside the partner-facing set (notes, tour elevation, start/end-point elevation) SHALL NOT trigger an edit notification.

#### Scenario: Non-meaningful change suppressed
- **WHEN** only notes, the tour elevation, or start/end-point elevations change and no partner-facing field differs
- **THEN** no edit notification is emitted

### Requirement: Going private does not emit an edit notification

Toggling visibility to `private` SHALL NOT emit an edit notification (the tour simply stops being visible to friends).

#### Scenario: Going private does not notify
- **WHEN** the owner switches a tour from friends to private
- **THEN** no `tour_updates` edit notification is emitted and the tour ceases to be visible to friends

### Requirement: Collision scan runs on create or meaningful update

Independently of `tour_updates`, a create or a meaningful update of a friends-visible tour SHALL run the collision scan defined in "Collision scan after tour save"; that scan emits under the separate `tour_interest` type. A completion or visibility flip alone SHALL NOT run the scan.

#### Scenario: Collision scan runs regardless of meaningful-edit filter
- **WHEN** a friends-visible tour is created or meaningfully updated
- **THEN** the collision scan runs and may emit `tour_interest` notifications independently of whether `tour_updates` is emitted

#### Scenario: Completion flip does not rescan
- **WHEN** the only change is marking the tour completed
- **THEN** no collision scan runs
