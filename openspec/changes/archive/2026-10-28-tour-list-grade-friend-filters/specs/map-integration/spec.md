## ADDED Requirements

### Requirement: Tour markers follow the tour list

While the tour list is open and its search or filters narrow the active tab, the map SHALL show markers, clusters and outing chains only for the tours that list shows; an outing listed as one row SHALL keep all its segments. Tours it can never show (non-partner friend tours) SHALL stay unmarked. With no search and no active filter, and whenever the list is closed, the map SHALL show every tour as before.

#### Scenario: Filtering the list thins the map

- **WHEN** the tour list is open on My Tours and the grade filter keeps two of five tours
- **THEN** the map SHALL show markers for those two tours only
- **AND** clusters SHALL count only those two

#### Scenario: Search thins the map

- **WHEN** the user types a query that matches one tour
- **THEN** the map SHALL show that tour's marker only

#### Scenario: Friends tab narrows to listed partner tours

- **WHEN** the Friends tab is active and its filters keep one tour the viewer is a partner on and one they are not
- **THEN** the map SHALL show the partner tour's marker only, and no owned tour

#### Scenario: A filtered-out tour no longer shadows

- **WHEN** a partner friend tour shares its spot with an owned tour and the Friends tab's filters keep the friend tour
- **THEN** the friend tour's marker SHALL be shown

#### Scenario: Outing kept whole

- **WHEN** a filter matches one segment of a three-segment outing
- **THEN** the map SHALL show all three segments and their chain

#### Scenario: Clearing restores every marker

- **WHEN** the user clears search and filters, or closes the tour list
- **THEN** the map SHALL show every tour again
