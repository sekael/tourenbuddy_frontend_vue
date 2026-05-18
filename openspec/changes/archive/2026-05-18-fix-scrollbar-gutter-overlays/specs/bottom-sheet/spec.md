## ADDED Requirements

### Requirement: Content scroll region reserves scrollbar gutter

The scrollable content region of `BottomSheet` SHALL reserve space for the scrollbar so that the scrollbar never overlaps text, buttons, or interactive controls. The scrollbar SHALL render with a thin, app-consistent style.

#### Scenario: Desktop / Chromium browsers with reservable gutter
- **WHEN** content overflows the sheet's content region in a browser that honors `scrollbar-gutter`
- **THEN** a scrollbar gutter SHALL be reserved on the inline-end side
- **AND** content SHALL NOT shift horizontally when the scrollbar appears or disappears

#### Scenario: Mobile browsers with overlay scrollbars
- **WHEN** content overflows the sheet's content region on iOS Safari or Android Chrome
- **THEN** the overlay scrollbar SHALL sit over reserved right padding inside the content region
- **AND** the scrollbar SHALL NOT overlap text, buttons, or toggles
