## MODIFIED Requirements

### Requirement: Tour info display

A component SHALL display tour details including name, planned date, coordinates, and partner names as chips, as well as all extended fields when present. The component SHALL also expose edit and delete entry points for the currently displayed tour. Partner chips SHALL be rendered in action mode (clicking opens the contact action menu — see `contact-chip-actions`) and SHALL NOT render inline phone action icons. When the tour has more than one partner, a group messaging row SHALL appear beneath the chips (see `tour-group-messaging`).

#### Scenario: Display tour with partners

- **WHEN** the tour info component is shown for a tour with partners
- **THEN** it SHALL display the tour name (or "Unnamed tour"), formatted date, coordinates, and partner names resolved from the contacts store
- **AND** the partner chips SHALL open the contact action menu on click
- **AND** the partner chips SHALL NOT render inline call or WhatsApp icons

#### Scenario: Display tour with multiple partners

- **WHEN** the tour info component is shown for a tour with two or more partners
- **THEN** a group messaging row SHALL be rendered beneath the partner chips

#### Scenario: Display tour without partners

- **WHEN** the tour info component is shown for a tour with no partners
- **THEN** it SHALL display the tour details without a partners section
- **AND** it SHALL NOT render a group messaging row

#### Scenario: Round trip detection

- **WHEN** a tour has a start point but null end point, or start and end are equal coordinates
- **THEN** the info sheet SHALL display "Round trip" for the end point row

#### Scenario: Edit and delete actions present

- **WHEN** the tour info sheet is shown
- **THEN** it SHALL display an edit action and a delete action that trigger the edit mode and the delete confirmation flow respectively
