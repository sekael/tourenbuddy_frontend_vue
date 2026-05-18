## ADDED Requirements

### Requirement: Drawer scroll region reserves scrollbar gutter

The scrollable content region of `SideDrawer` SHALL reserve space for the scrollbar so the scrollbar never overlaps content. Scrollbar SHALL render with a thin, app-consistent style.

#### Scenario: Drawer content overflows on desktop
- **WHEN** drawer content overflows in a browser that honors `scrollbar-gutter`
- **THEN** a scrollbar gutter SHALL be reserved on the inline-end side
- **AND** content SHALL NOT shift horizontally when the scrollbar appears or disappears

#### Scenario: Drawer content overflows on mobile
- **WHEN** drawer content overflows in a browser using overlay scrollbars
- **THEN** the overlay scrollbar SHALL sit over reserved right padding inside the content region and SHALL NOT overlap interactive controls
