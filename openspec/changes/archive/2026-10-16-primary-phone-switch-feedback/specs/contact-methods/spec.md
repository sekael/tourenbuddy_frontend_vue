# Spec Delta

## ADDED Requirements

### Requirement: Visible primary phone switch

When the user makes another phone primary in the contact detail view, the switch SHALL play as three sequential steps: the previous primary's highlight fades out, the rows reorder with a visible eased movement that brings the new primary to the top, then the new primary's highlight fades in. The sequence SHALL start on the tap, without waiting for the save. Users who request reduced motion SHALL see the switch at once.

#### Scenario: Promoting a phone plays the staged switch

- **WHEN** a contact has two or more phones and the user taps the star of a non-primary phone in edit mode
- **THEN** the previous primary's highlight SHALL fade out first, then that phone SHALL move to the top while the previous primary moves down, and only then SHALL its highlight fade in

#### Scenario: Slow save

- **WHEN** the save takes longer than the fade-out
- **THEN** the sequence SHALL still proceed from the tap, not wait for the save

#### Scenario: Failed save

- **WHEN** the save fails after the sequence started
- **THEN** the list SHALL return to the previous primary through the same staged steps, skipping the movement if the rows have not moved yet, and SHALL show the error

#### Scenario: Reduced motion

- **WHEN** the user's system requests reduced motion and a phone is made primary
- **THEN** the highlight and order SHALL switch at once, without fades or movement

### Requirement: Primary phone is highlighted and not re-selectable

With more than one phone, the contact detail view SHALL visually highlight the primary phone row beyond its filled star. The primary phone SHALL NOT offer a "set as primary" action in any mode; only non-primary phones SHALL. While a switch's save is pending, further taps on any star SHALL be ignored.

#### Scenario: Primary row highlighted

- **WHEN** a contact with two or more phones is shown in the detail view
- **THEN** the primary phone row SHALL be highlighted and the other phone rows SHALL NOT

#### Scenario: Single phone not highlighted

- **WHEN** a contact has exactly one phone
- **THEN** that row SHALL NOT carry the primary highlight

#### Scenario: Primary star inert in edit mode

- **WHEN** the detail view is in edit mode and no switch is in progress
- **THEN** the primary phone's star SHALL be non-interactive, and every non-primary phone's star SHALL be a button that makes it primary

#### Scenario: Taps during a pending switch

- **WHEN** the user taps a star while a previous switch's save is still pending
- **THEN** no second switch SHALL start
