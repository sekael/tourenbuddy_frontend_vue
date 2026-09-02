## ADDED Requirements

### Requirement: Pending-suggestion indicator on owned tour rows

A tour row in the list view SHALL show an indicator when the viewer owns that tour and it
carries pending suggestions, so the owner finds waiting proposals without opening each
tour. The count SHALL derive from the suggestion store's single user-scoped load, not from
a per-row query. Friend tours SHALL show no such indicator, and a tour with no pending
suggestions SHALL show none.

#### Scenario: Owned tour with pending suggestions
- **WHEN** the owner views the list and one of their tours has two pending suggestions
- **THEN** that row shows a pending indicator

#### Scenario: Resolved suggestions clear the indicator
- **WHEN** the owner resolves the last pending suggestion on a tour
- **THEN** the indicator disappears from that row without a manual reload

#### Scenario: Friend tour rows carry no indicator
- **WHEN** the list renders a friend's tour on which the viewer has authored a pending suggestion
- **THEN** no owner-facing pending indicator is shown on that row
