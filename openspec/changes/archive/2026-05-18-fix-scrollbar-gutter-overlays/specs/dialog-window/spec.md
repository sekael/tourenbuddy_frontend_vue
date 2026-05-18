## ADDED Requirements

### Requirement: Dialog content reserves scrollbar gutter

The scrollable content region of `DialogWindow` SHALL reserve space for the scrollbar so the scrollbar never overlaps content. Existing thin scrollbar styling SHALL be retained.

#### Scenario: Content overflows dialog
- **WHEN** the slotted content overflows the dialog's content region in a browser that honors `scrollbar-gutter`
- **THEN** a scrollbar gutter SHALL be reserved on the inline-end side
- **AND** content SHALL NOT shift horizontally when the scrollbar appears or disappears

#### Scenario: Mobile/overlay scrollbar fallback
- **WHEN** the dialog content overflows in a browser using overlay scrollbars
- **THEN** the overlay scrollbar SHALL sit over reserved right padding inside the content region and SHALL NOT overlap interactive controls
