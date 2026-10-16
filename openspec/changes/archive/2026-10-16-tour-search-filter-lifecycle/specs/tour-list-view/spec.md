# Spec Delta

## ADDED Requirements

### Requirement: Stable list sheet height while searching

On mobile, the tour list sheet SHALL NOT shrink while a search query or any filter is active, so results stay above the on-screen keyboard. Clearing search and filters SHALL let the sheet fit its content again.

#### Scenario: Typing a narrowing query

- **WHEN** the user types a search query that reduces the number of visible tours
- **THEN** the tour list sheet height SHALL NOT decrease

#### Scenario: Applying a narrowing filter

- **WHEN** the user activates a filter that reduces the number of visible tours
- **THEN** the tour list sheet height SHALL NOT decrease

### Requirement: Search and filters reset when the list is left

Leaving the tour list SHALL clear the search query and every filter on both tabs. Opening a tour from the list and returning to the list SHALL keep them. The last-viewed tab SHALL still be remembered.

#### Scenario: Closing the list

- **WHEN** the user has a search query or active filters and closes the tour list sheet or side drawer
- **THEN** reopening the list SHALL show an empty search input, no active filters, and all tours

#### Scenario: Switching to another overlay

- **WHEN** the user opens another overlay (e.g. contacts) from the menu while the tour list is open
- **THEN** the tour list's search query and filters SHALL be cleared

#### Scenario: Round-trip through a tour detail

- **WHEN** the user opens a tour from a searched/filtered list and returns to the list
- **THEN** the search query and filters SHALL be unchanged

#### Scenario: Closing a tour opened from the list

- **WHEN** the user opens a tour from a searched/filtered list and closes the tour detail instead of returning
- **THEN** the search query and filters SHALL be cleared
