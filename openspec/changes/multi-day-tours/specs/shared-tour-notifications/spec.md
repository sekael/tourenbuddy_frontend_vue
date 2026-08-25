## MODIFIED Requirements

### Requirement: Meaningful-edit filtering

The system SHALL emit edit notifications only when a partner-facing field changes. The partner-facing set is: name, planned date **span** (either endpoint — the planned start date or the end date), goal location, tour type, partners, completion flip, GPX track added/changed, description, and equipment. Changes confined to other fields (notes, elevation, seasons, start/end-point detail) SHALL NOT trigger a notification. Toggling visibility to `private` SHALL NOT emit an edit notification (the tour simply stops being visible to friends). Independently of `tour_updates`, any successful create or update of a tour SHALL trigger the Worker collision scan defined below; that scan dispatches under the separate `tour_interest` type and is not subject to the meaningful-edit filter.

#### Scenario: Meaningful field changed
- **WHEN** the planned date, equipment, or description of a shared tour changes
- **THEN** an edit notification is dispatched to friend partners

#### Scenario: Span length changed
- **WHEN** a shared tour's end date is added, removed, or moved while its planned start date is unchanged
- **THEN** an edit notification is dispatched to friend partners

#### Scenario: Completion or GPX change notifies
- **WHEN** a shared tour is marked completed or a GPX track is added
- **THEN** an edit notification is dispatched to friend partners
