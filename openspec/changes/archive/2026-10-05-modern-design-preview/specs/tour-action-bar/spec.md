## MODIFIED Requirements

### Requirement: Persistent bottom-center tour action bar

The map page SHALL render a persistent action bar over the map, anchored bottom-center on both mobile and desktop viewports. The bar SHALL be a single rounded pill container with two tappable segments separated by a 1px divider in `--color-fab-border`: a primary "My Tours" segment (Material Symbols `location_on` icon + label from `map.actionBar.myTours`) and a trailing icon-only Add-tour segment (Material Symbols `add_location_alt` icon, no visible label, accessible name from `map.actionBar.addTourAriaLabel`). The pill SHALL respect `env(safe-area-inset-bottom)` and SHALL wear the shared map-control glass surface (`.fab-glass`: `--color-fab-glass`, `--shadow-md`, backdrop blur), with a 52px height and full pill corners (`--radius-pill`).

#### Scenario: Bar mounted on map page

- **WHEN** the user opens the map page with no overlay active and `mapStore.isPickingLocation === false`
- **THEN** the bottom-center action bar SHALL be visible
- **AND** SHALL render a single pill with two segments in this DOM order: My Tours (text + icon), divider, Add-tour (icon only)

#### Scenario: Same layout on mobile and desktop

- **WHEN** the bar is visible on a viewport below 600px AND on a viewport at or above 600px
- **THEN** the bar SHALL be positioned bottom-center in both layouts using the same component instance and styling
