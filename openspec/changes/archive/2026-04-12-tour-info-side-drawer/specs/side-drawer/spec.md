## ADDED Requirements

### Requirement: SideDrawer component renders as a right-edge panel

The `SideDrawer` component SHALL render as a panel anchored to the right edge of the viewport on desktop viewports (>=600px). On mobile viewports (<600px), the `SideDrawer` SHALL render as a bottom sheet using the existing `BottomSheet` component, preserving the mobile experience unchanged.

#### Scenario: Desktop drawer appearance

- **WHEN** the viewport width is at or above 600px
- **AND** a `SideDrawer` component is rendered
- **THEN** the drawer SHALL be anchored to the right edge of the viewport
- **AND** the drawer SHALL span the full viewport height
- **AND** the drawer SHALL have a fixed width of 400px
- **AND** the drawer SHALL have a left border for visual separation from the map

#### Scenario: Mobile fallback to bottom sheet

- **WHEN** the viewport width is below 600px
- **AND** a `SideDrawer` component is rendered
- **THEN** the component SHALL render using the `BottomSheet` component
- **AND** the mobile behavior SHALL be identical to a standard `BottomSheet`

### Requirement: SideDrawer slide-in animation

The `SideDrawer` SHALL animate in from the right edge on desktop with a horizontal slide transition.

#### Scenario: Desktop slide-in animation

- **WHEN** a `SideDrawer` enters the DOM on a viewport at or above 600px
- **THEN** it SHALL animate in with a `translateX(100%)` to `translateX(0)` slide-right-to-left transition
- **AND** when leaving, it SHALL animate out with a `translateX(0)` to `translateX(100%)` slide-left-to-right transition

#### Scenario: Mobile slide-up animation unchanged

- **WHEN** a `SideDrawer` enters the DOM on a viewport below 600px
- **THEN** it SHALL use the standard `BottomSheet` slide-up transition

### Requirement: SideDrawer API contract

The `SideDrawer` component SHALL accept the same props as `BottomSheet` (`title?: string`, `ariaLabel?: string`), emit a `close` event, and provide a default slot for content.

#### Scenario: Props and emits match BottomSheet

- **WHEN** a `SideDrawer` is instantiated
- **THEN** it SHALL accept `title?: string` and `ariaLabel?: string` props
- **AND** it SHALL emit `close` when the close button is clicked
- **AND** it SHALL provide a default slot for content

### Requirement: SideDrawer does not render a backdrop on desktop

On desktop, the `SideDrawer` SHALL NOT render a semi-transparent backdrop scrim because the drawer is designed to coexist with the visible map. The map background click mechanism in `map-page.vue` handles dismissal.

#### Scenario: No backdrop on desktop

- **WHEN** the viewport width is at or above 600px
- **AND** a `SideDrawer` is rendered
- **THEN** no backdrop or scrim element SHALL be displayed behind the drawer

#### Scenario: Dismiss via map background click

- **WHEN** a `SideDrawer` is open on desktop
- **AND** the user clicks on the map background outside the drawer
- **THEN** the parent page SHALL close the drawer via the existing map-background-click mechanism
