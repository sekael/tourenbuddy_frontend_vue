## MODIFIED Requirements

### Requirement: Map controls are legible and stand out from the map

Floating map controls (menu trigger and items, compass, action bar, base-map options) SHALL share one glass surface and render their labels and icons with at least 4.5:1 contrast against it, including the surface's translucency over a white map, and SHALL remain visually separated from the map background. The guided-tour banner SHALL use the same map-control blue as an opaque surface. Indicators on a control (notification dot, count badge) SHALL contrast with the control.

#### Scenario: Labels over a bright map

- **WHEN** the speed-dial menu is open over a white map area
- **THEN** every item label reads at ≥ 4.5:1 and the controls are distinct from the map

#### Scenario: Guided-tour finish button

- **WHEN** the guided tour banner is shown
- **THEN** the "finish tour" label reads at ≥ 4.5:1 against the button behind it
