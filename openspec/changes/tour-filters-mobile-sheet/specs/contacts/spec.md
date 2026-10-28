## MODIFIED Requirements

### Requirement: A friend's tours from the contact detail

The detail view of a contact linked to an accepted friend, and not blocked, SHALL offer a "Show tours" action, marked with the route icon (a path between two points) — not a location pin, which reads as a place. It SHALL open the tour list on the Friends tab with the search cleared and only the recorded-by filter set, to that friend. Other contacts SHALL NOT offer the action.

#### Scenario: Opening a friend's tours

- **WHEN** the user opens a friend's contact detail and activates "Show tours"
- **THEN** the contacts overlay SHALL be replaced by the tour list on the Friends tab
- **AND** the list SHALL show only tours that friend recorded, with the recorded-by filter holding that friend and the filters badge showing 1

#### Scenario: Earlier list state does not leak in

- **WHEN** the Friends tab had a search query or other filters before
- **THEN** opening a friend's tours from the contact detail SHALL clear them first

#### Scenario: Not offered for other contacts

- **WHEN** the contact is not linked to a friend, or is blocked
- **THEN** the "Show tours" action SHALL NOT be shown

#### Scenario: Not offered while editing

- **WHEN** the contact detail is in edit mode
- **THEN** the "Show tours" action SHALL NOT be shown

#### Scenario: Action reads as tours

- **WHEN** the "Show tours" action is shown
- **THEN** it SHALL carry the route icon, not a location pin
