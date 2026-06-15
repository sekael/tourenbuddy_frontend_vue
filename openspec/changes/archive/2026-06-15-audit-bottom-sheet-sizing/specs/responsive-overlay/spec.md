## ADDED Requirements

### Requirement: Adaptive overlay defaults its mobile arm to fit-content

`AdaptiveOverlay` SHALL accept a `fitContent` prop that **defaults to true** and SHALL forward it to the `BottomSheet` it renders on viewports below 600px. This makes fit-content the default sizing for every overlay routed through `AdaptiveOverlay`, so their content is fully visible without a drag-up. A consumer MAY pass `:fit-content="false"` to opt back into snap behavior. On viewports at or above 600px (the `DialogWindow` arm) the prop SHALL have no effect, since the centered dialog already sizes to its content.

#### Scenario: Mobile arm defaults to fit-content

- **WHEN** an `AdaptiveOverlay` with no `fitContent` prop is rendered on a viewport below 600px
- **THEN** the underlying `BottomSheet` SHALL receive `fitContent: true`
- **AND** the sheet SHALL size to `min(content, 60vh)` rather than a snap point

#### Scenario: Consumer opts back into snap

- **WHEN** an `AdaptiveOverlay` is rendered on a viewport below 600px with `:fit-content="false"`
- **THEN** the underlying `BottomSheet` SHALL use the default snap behavior

#### Scenario: Desktop arm ignores fit-content

- **WHEN** an `AdaptiveOverlay` is rendered on a viewport at or above 600px
- **THEN** it SHALL render as a `DialogWindow` as before
- **AND** the `fitContent` prop SHALL not alter the dialog's appearance or sizing