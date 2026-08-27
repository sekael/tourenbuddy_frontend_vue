## ADDED Requirements

### Requirement: End-date input for multi-day tours

The tour form SHALL render, adjacent to the planned-date input, a second optional date input
for the end of the tour, labelled distinctly from the planned (start) date. Leaving it empty
SHALL produce a single-day tour (`endDate === null`).

The end-date input SHALL carry a `min` attribute bound to the current planned-date value, and
the form SHALL additionally reject submission when the end date precedes the planned date,
surfacing a localized validation message and keeping the user on the form. The `min`
attribute alone SHALL NOT be relied upon, as a typed value can bypass it.

Clearing the planned date SHALL NOT silently strand an end date: when the planned date is
empty, the end date SHALL be cleared as well.

#### Scenario: End date left empty

- **WHEN** the user saves a tour with a planned date and no end date
- **THEN** the resulting draft SHALL carry `endDate === null` and the tour SHALL be persisted
  as a single-day tour

#### Scenario: End date before start date

- **WHEN** the user enters an end date earlier than the planned date and submits
- **THEN** the form SHALL NOT submit, SHALL display a localized validation message on the
  end-date field, and no write SHALL be dispatched

#### Scenario: Planned date cleared while an end date is set

- **WHEN** the user clears the planned date on a tour that has an end date
- **THEN** the end date SHALL be cleared too, so no tour is saved with an end but no start

#### Scenario: Editing an existing multi-day tour

- **WHEN** the form opens for a tour with a planned date and an end date
- **THEN** both inputs SHALL be pre-filled with those dates
