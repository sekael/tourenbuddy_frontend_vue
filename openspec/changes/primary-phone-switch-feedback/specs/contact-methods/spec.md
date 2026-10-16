# Spec Delta

## ADDED Requirements

### Requirement: Visible primary phone switch

When the user makes another phone primary in the contact detail view, the phone list SHALL animate the reorder so the new primary visibly travels to the top of the list, instead of jumping instantly. Users who request reduced motion SHALL see the reorder without the movement animation.

#### Scenario: Promoting a phone animates the reorder

- **WHEN** a contact has two or more phones and the user taps the star of a non-primary phone in edit mode
- **THEN** that phone SHALL move to the top of the phone list with a visible, eased movement, and the previous primary SHALL move down

#### Scenario: Reduced motion

- **WHEN** the user's system requests reduced motion and a phone is made primary
- **THEN** the list SHALL reorder without the movement animation

### Requirement: Primary phone is highlighted and not re-selectable

With more than one phone, the contact detail view SHALL visually highlight the primary phone row beyond its filled star. The primary phone SHALL NOT offer a "set as primary" action in any mode; only non-primary phones SHALL.

#### Scenario: Primary row highlighted

- **WHEN** a contact with two or more phones is shown in the detail view
- **THEN** the primary phone row SHALL be highlighted and the other phone rows SHALL NOT

#### Scenario: Single phone not highlighted

- **WHEN** a contact has exactly one phone
- **THEN** that row SHALL NOT carry the primary highlight

#### Scenario: Primary star inert in edit mode

- **WHEN** the detail view is in edit mode
- **THEN** the primary phone's star SHALL be non-interactive, and every non-primary phone's star SHALL be a button that makes it primary
