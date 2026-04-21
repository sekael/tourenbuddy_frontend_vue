## ADDED Requirements

### Requirement: SideDrawer supports a collapsed header-only mode

The `SideDrawer` component SHALL accept a `collapsed: boolean` prop. When `collapsed` is true, the drawer SHALL render only a compact header showing its `title` (for example, "Edit: Uri Rotstock") and SHALL hide its default slot, its close button, and any drag handle. Dismissal via map-background click, backdrop click, or the Escape key SHALL be suppressed while `collapsed` is true. When `collapsed` becomes false, the drawer SHALL restore its full body and dismissal affordances without losing any slot content state.

#### Scenario: Desktop collapsed header placement

- **WHEN** the viewport width is at or above 600px
- **AND** a `SideDrawer` is rendered with `collapsed: true` and `title: "Edit: Uri Rotstock"`
- **THEN** the drawer SHALL render as a compact header in the top-right corner showing the title
- **AND** the drawer SHALL NOT render its default slot content
- **AND** the drawer SHALL NOT render a close button
- **AND** clicking the map background SHALL NOT close the drawer

#### Scenario: Mobile collapsed bottom sheet

- **WHEN** the viewport width is below 600px
- **AND** a `SideDrawer` is rendered with `collapsed: true`
- **THEN** the underlying `BottomSheet` SHALL render only a title-only header
- **AND** the sheet SHALL NOT render a close button
- **AND** the sheet SHALL NOT render a drag handle
- **AND** clicking the backdrop or map background SHALL NOT close the sheet
- **AND** pressing Escape SHALL NOT close the sheet

#### Scenario: Slot state preserved across collapse toggle

- **WHEN** a `SideDrawer` is toggled from `collapsed: false` to `collapsed: true` and back to `collapsed: false`
- **THEN** the slot content SHALL remain mounted throughout
- **AND** any in-progress Vue state inside the slot (for example, form input values) SHALL be preserved
