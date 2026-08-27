## ADDED Requirements

### Requirement: Planned date renders as a span

The tour info view SHALL render a tour's planned date as a locale-formatted date **range**
when the tour has an end date, and as a single locale-formatted date when it does not. The
range SHALL be produced by the locale's own range formatting (`Intl.DateTimeFormat`
`formatRange`), not by concatenating two formatted dates with a hard-coded separator.

#### Scenario: Multi-day tour

- **WHEN** a tour has a planned date of 25 August 2026 and an end date of 27 August 2026
- **THEN** the info view SHALL show a single range label covering both dates, formatted per
  the active locale

#### Scenario: Single-day tour

- **WHEN** a tour has a planned date and no end date
- **THEN** the info view SHALL show exactly the single formatted date it showed before this
  capability existed

#### Scenario: Undated tour

- **WHEN** a tour has no planned date
- **THEN** no date label SHALL be rendered, regardless of the end date value
