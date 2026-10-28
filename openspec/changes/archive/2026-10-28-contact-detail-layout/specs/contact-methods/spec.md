## MODIFIED Requirements

### Requirement: Primary phone is highlighted and not re-selectable

With more than one phone, the contact detail view SHALL visually highlight the primary phone row beyond its filled star. The primary phone SHALL NOT offer a "set as primary" action in any mode; only non-primary phones SHALL. While a switch's save is pending, further taps on any star SHALL be ignored. In view mode, a contact with a single phone SHALL show no primary star.

#### Scenario: Primary row highlighted

- **WHEN** a contact with two or more phones is shown in the detail view
- **THEN** the primary phone row SHALL be highlighted and the other phone rows SHALL NOT

#### Scenario: Single phone not highlighted

- **WHEN** a contact has exactly one phone
- **THEN** that row SHALL NOT carry the primary highlight
- **AND** in view mode it SHALL show no star

#### Scenario: Primary star inert in edit mode

- **WHEN** the detail view is in edit mode and no switch is in progress
- **THEN** the primary phone's star SHALL be non-interactive, and every non-primary phone's star SHALL be a button that makes it primary

#### Scenario: Taps during a pending switch

- **WHEN** the user taps a star while a previous switch's save is still pending
- **THEN** no second switch SHALL start
