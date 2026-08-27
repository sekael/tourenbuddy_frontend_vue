## ADDED Requirements

### Requirement: End date field

The tour schema SHALL include an `endDate` field (date, nullable) representing the last day
of a multi-day tour, where `plannedDate` is the first day. A null `endDate` SHALL mean a
single-day tour and SHALL be indistinguishable in behaviour from the model before this
capability existed.

The persisted column SHALL be `tours.end_date date`, exposed as `end_date` by `tours_view`
and `friend_tours_view`, and SHALL be constrained such that `end_date >= planned_date`
whenever both are non-null.

The tour write RPCs `create_tour_full` and `update_tour_full` SHALL accept the span end as a
trailing `p_end_date date` argument defaulting to null, so a call that omits it persists a
single-day tour.

#### Scenario: Row without an end date

- **WHEN** a tour row is read whose `end_date` is null
- **THEN** the mapped tour SHALL have `endDate === null` and SHALL be treated as a single-day
  tour by every consumer

#### Scenario: Row with an end date

- **WHEN** a tour row is read with `planned_date = 2026-08-25` and `end_date = 2026-08-27`
- **THEN** the mapped tour SHALL have both dates set and SHALL be treated as spanning three
  days inclusive

#### Scenario: End date before start date is rejected

- **WHEN** a write is attempted with `end_date` earlier than `planned_date`
- **THEN** the database CHECK constraint SHALL reject the write

#### Scenario: Write RPC called without the end-date argument

- **WHEN** `create_tour_full` or `update_tour_full` is invoked without `p_end_date` (for
  example by an offline write queued before this capability shipped)
- **THEN** the call SHALL succeed and the tour SHALL be persisted with `end_date` null

## MODIFIED Requirements

### Requirement: Extended TourDraft

The `TourDraft` interface SHALL be expanded to include all new optional fields: `tourType`,
`elevation`, `gpxTrack`, `description`, `seasons`, `startPoint`, `endPoint`, `equipment`,
`notes`, `endDate`.

#### Scenario: Draft with all fields

- **WHEN** a TourDraft is created with all new fields populated
- **THEN** it SHALL be a valid TourDraft object

#### Scenario: Draft with no new fields (backward compatible)

- **WHEN** a TourDraft is created with only name, plannedDate, and partnerIds
- **THEN** it SHALL be valid with all new fields defaulting to null/undefined, and the tour
  SHALL be persisted as a single-day tour
