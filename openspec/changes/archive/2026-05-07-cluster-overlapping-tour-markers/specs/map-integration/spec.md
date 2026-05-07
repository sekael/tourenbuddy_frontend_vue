## ADDED Requirements

### Requirement: Tour markers cluster when overlapping

When two or more tour circle markers would visually overlap at the current zoom level, the map SHALL aggregate them into a single cluster marker. Cluster aggregation SHALL be driven by MapLibre's native GeoJSON clustering using a pixel-based collision radius derived from the non-cluster circle radius (such that a non-overlap distance at the current zoom guarantees no clustering). When the user zooms in past the collision threshold, clusters SHALL split, and any tours that still overlap at the new zoom SHALL re-aggregate into smaller clusters automatically. Single (non-colliding) tour markers SHALL retain the existing circle-layer rendering, including type-based color, completed-check overlay, selected-state styling, and click-to-select behavior.

#### Scenario: Overlapping markers aggregate into one cluster

- **WHEN** two or more tour markers would render within the cluster collision radius at the current zoom
- **THEN** they SHALL be replaced by a single cluster marker rendered at the cluster's centroid
- **AND** the underlying single-tour circle layer SHALL NOT render those points

#### Scenario: Non-overlapping markers render normally

- **WHEN** a tour marker has no neighbors within the collision radius at the current zoom
- **THEN** it SHALL render via the existing single-tour circle layer with no change to color, completed glyph, or selected state

#### Scenario: Zoom-in splits clusters

- **WHEN** the user zooms in such that previously clustered markers are farther apart than the collision radius
- **THEN** the cluster SHALL be removed
- **AND** the constituent tours SHALL render as individual circle markers (or as smaller clusters if subsets still collide)

#### Scenario: Zoom-out re-aggregates markers

- **WHEN** the user zooms out such that previously separate markers now fall within the collision radius
- **THEN** the affected markers SHALL be replaced by a cluster marker

### Requirement: Cluster marker renders a pie chart by tour type

A cluster marker SHALL be rendered as a single circular pie chart whose slices correspond to tour types present in the cluster. Each slice's central angle SHALL be proportional to the count of tours of that type within the cluster (slice angle = `count_of_type / total_count * 360°`). Slice fill colors SHALL come from the existing `TOUR_TYPE_COLORS` palette used by single-tour markers; tours with `tourType === null` SHALL contribute a slice using the same neutral fallback color used for unknown types on single markers. The cluster marker SHALL display the total tour count as a centered numeric label readable against any slice color (white text with a contrast outline or backdrop).

#### Scenario: Mixed-type cluster shows proportional slices

- **WHEN** a cluster contains 2 ski tours and 2 mountaineering tours
- **THEN** the cluster marker SHALL render as a circle composed of two slices: one half in the ski (winter/blue) color and one half in the mountaineering (summer/red) color
- **AND** the centered label SHALL read `4`

#### Scenario: Single-type cluster shows full circle

- **WHEN** a cluster contains 3 tours all of the same tour type
- **THEN** the cluster marker SHALL render as a full circle in that tour type's color with the centered label `3`

#### Scenario: Cluster includes a tour with null tourType

- **WHEN** a cluster contains tours with `tourType === null`
- **THEN** those tours SHALL contribute a slice in the neutral fallback color, sized proportionally to their count

### Requirement: Cluster split and merge animate smoothly

When a cluster splits on zoom-in, each leaf tour marker SHALL animate from the parent cluster's last-rendered screen position to its true geographic coordinates (a fan-out transition) rather than appear instantly. When a zoom-out causes individual markers to merge into a cluster, those leaf markers SHALL animate from their true coordinates toward the new cluster's centroid before the pie cluster appears in their place. Animations SHALL last between 250 ms and 400 ms, use an ease-out curve, and SHALL respect `prefers-reduced-motion: reduce` (when set, the transition is skipped and markers swap instantly). During an in-flight animation, the underlying GL circle layer SHALL NOT render the animating leaves (filter excludes them); the GL layer takes over immediately when the animation ends.

#### Scenario: Cluster split fans leaves out

- **WHEN** a zoom-in causes an existing cluster to dissolve into N individual tour markers
- **THEN** N temporary leaf markers SHALL appear at the old cluster's screen position
- **AND** they SHALL animate to their respective true coordinates over 250–400 ms using ease-out
- **AND** the GL circle layer SHALL not render those tour IDs until each animation completes

#### Scenario: Cluster merge collapses leaves inward

- **WHEN** a zoom-out causes two or more individual markers to be aggregated into a new cluster
- **THEN** temporary leaf markers SHALL animate from the leaves' previous true coordinates to the new cluster centroid
- **AND** the cluster pie marker SHALL render at the centroid once the animation completes

#### Scenario: Reduced-motion users get instant swap

- **WHEN** the user's environment reports `prefers-reduced-motion: reduce`
- **THEN** no animation SHALL play and markers SHALL swap immediately on zoom

#### Scenario: Mid-animation zoom interrupts cleanly

- **WHEN** the user starts a new zoom while a split or merge animation is still running
- **THEN** the in-flight animation SHALL be cancelled, temporary markers SHALL be removed, and rendering SHALL re-evaluate against the new zoom without leaving orphan DOM nodes

### Requirement: Cluster marker click expands the cluster

Clicking (or activating via keyboard) a cluster marker SHALL zoom the map to the cluster's expansion zoom level — the minimum zoom at which the cluster splits — using MapLibre's `getClusterExpansionZoom`. The map SHALL animate to that zoom centered on the cluster's coordinates.

#### Scenario: Click on cluster zooms to expansion zoom

- **WHEN** the user clicks a cluster marker
- **THEN** the map SHALL animate (`easeTo`) to the cluster's `getClusterExpansionZoom` centered on the cluster's coordinates

#### Scenario: Cluster marker is keyboard-activatable

- **WHEN** the cluster marker has keyboard focus and the user presses Enter or Space
- **THEN** the same expansion behavior SHALL occur as for a click

### Requirement: Cluster markers are accessible

Each cluster marker SHALL expose an accessible name conveying the total tour count. The accessible name SHALL be sourced from i18n (e.g. `map.cluster.label` with `{count}` interpolation) and provided to every locale present in the app.

#### Scenario: Cluster has localized aria-label

- **WHEN** a cluster marker with 4 tours is rendered
- **THEN** the marker's root element SHALL expose an accessible name equivalent to "Cluster of 4 tours" in the active locale
