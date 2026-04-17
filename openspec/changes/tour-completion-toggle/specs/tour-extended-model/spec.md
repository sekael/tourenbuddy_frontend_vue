## ADDED Requirements

### Requirement: Completed field

The tour schema SHALL include a `completed` field (boolean, non-nullable) indicating whether the user has marked the tour as done. The field SHALL default to `false` when absent from the source row.

#### Scenario: Tour explicitly completed

- **WHEN** a tour row has `completed = true`
- **THEN** the schema SHALL parse it as the boolean `true`

#### Scenario: Tour explicitly not completed

- **WHEN** a tour row has `completed = false`
- **THEN** the schema SHALL parse it as the boolean `false`

#### Scenario: Legacy row missing column

- **WHEN** a tour row lacks the `completed` column (pre-migration client-side cache)
- **THEN** the schema SHALL default the field to `false`

### Requirement: Extended TourDraft includes completion state

The `TourDraft` interface and tour update payload type SHALL accept an optional `completed` boolean so existing update paths can patch the field.

#### Scenario: Patch with completed true

- **WHEN** an update payload `{ completed: true }` is passed to the tour repository update method
- **THEN** the payload SHALL be valid and persisted to the `completed` column
