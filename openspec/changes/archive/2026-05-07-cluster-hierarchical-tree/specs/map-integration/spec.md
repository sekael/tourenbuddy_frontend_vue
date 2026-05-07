## ADDED Requirements

### Requirement: Cluster membership is a stable hierarchical tree

The renderer SHALL maintain a single hierarchical agglomerative cluster tree, built once per `updateTours` invocation, that fully determines cluster membership at every zoom level. Two tours that are in the same cluster at zoom Z SHALL remain in the same cluster lineage at every zoom Z' &le; Z; conversely, two tours separated at zoom Z SHALL remain separated at every zoom Z' &ge; Z. Cluster identity SHALL NOT depend on tile boundaries, snapshot timing, or non-monotone re-grouping. The tree SHALL persist between zoom changes and pans, and SHALL be discarded only when `updateTours` is called with a different tour list.

#### Scenario: Two tours that cluster at low zoom remain co-clustered at all lower zooms

- **GIVEN** two tours A and B that the tree assigns to the same cluster at zoom 10
- **WHEN** the user zooms out to zoom 8 and back to zoom 10 several times
- **THEN** A and B SHALL be assigned to the same cluster lineage at every zoom Z &le; 10 throughout the session

#### Scenario: Two tours that separate at high zoom remain separated at all higher zooms

- **GIVEN** two tours A and B whose merge node has `splitZoom = 11`
- **WHEN** the user zooms in past zoom 11 and back several times
- **THEN** A and B SHALL be rendered as separate visible nodes at every zoom Z > 11 throughout the session

#### Scenario: Tree rebuild on tour list change

- **WHEN** `updateTours` is invoked with a new tour list
- **THEN** the tree SHALL be rebuilt from scratch using the new list
- **AND** any in-flight cluster animations SHALL be cancelled
- **AND** the renderer SHALL diff the previously committed visible state against the new forest cut at the current zoom and animate the resulting differences

### Requirement: Cluster split / merge animations fire only when a `splitZoom` threshold is crossed

The renderer SHALL fire a split or merge animation if and only if the user's zoom gesture crosses the `splitZoom` of at least one tree node. Pan gestures, intra-band zoom (zoom changes that do not cross any node's `splitZoom`), and programmatic camera moves that do not cross thresholds SHALL produce zero marker churn — visible markers SHALL translate with the map but SHALL NOT be removed, recreated, or faded. Animations SHALL be triggered during the gesture (not deferred to `zoomend`) by sampling `zoom` events and detecting threshold crossings against the previously sampled zoom.

#### Scenario: Pure pan produces no animation

- **WHEN** the user pans the map without changing zoom
- **THEN** no split or merge animation SHALL fire
- **AND** the visible cluster and tour markers SHALL remain mounted in the DOM

#### Scenario: Zoom within a threshold-free band produces no animation

- **GIVEN** the closest two `splitZoom` values to the current zoom are at zoom 8 and zoom 11, and the current zoom is 9.5
- **WHEN** the user zooms to 10.4 and back to 9.5
- **THEN** no split or merge animation SHALL fire

#### Scenario: Crossing one threshold during zoom-in fires one split animation

- **GIVEN** a node N has `splitZoom = 10.3`
- **WHEN** the user zooms from zoom 10.0 to zoom 10.6 in a single gesture
- **THEN** the renderer SHALL fire exactly one split animation for N during the gesture, beginning when the zoom crosses 10.3
- **AND** the animation SHALL begin before `zoomend` fires

#### Scenario: Crossing multiple thresholds during one gesture fires the corresponding animations

- **GIVEN** nodes N1, N2 have `splitZoom = 9.5, 10.5` respectively
- **WHEN** the user zooms from zoom 9.0 to zoom 11.0 in a single gesture
- **THEN** the renderer SHALL fire a split animation for N1 when the zoom crosses 9.5
- **AND** SHALL fire a split animation for N2 when the zoom crosses 10.5

### Requirement: Cluster click navigates to `splitZoom + ε` or spiderfies if unreachable

When the user clicks a cluster marker for node N, the renderer SHALL invoke `map.easeTo({ center: N.centroid, zoom: N.splitZoom + ε })` where `ε` is a small positive constant (≈ 0.01), unless `N.splitZoom > map.getMaxZoom()`, in which case the renderer SHALL invoke `spiderfier.spiderfy(N)` instead. The split animation that fires when the easeTo zoom crosses `N.splitZoom` SHALL be the same animation that would fire from a user-initiated zoom — there SHALL NOT be a separate click-driven animation code path.

#### Scenario: Click on expandable cluster zooms past split threshold

- **GIVEN** a cluster node N with `splitZoom = 12` and `map.getMaxZoom() = 18`
- **WHEN** the user clicks N's marker
- **THEN** `map.easeTo` SHALL be invoked with target zoom strictly greater than 12 (ε > 0)
- **AND** the standard split animation SHALL fire as the easeTo crosses zoom 12

#### Scenario: Click on un-expandable cluster spiderfies

- **GIVEN** a cluster node N with `splitZoom > map.getMaxZoom()` (e.g. tours at near-identical coordinates)
- **WHEN** the user clicks N's marker
- **THEN** the spiderfier SHALL be invoked with N's leaves
- **AND** `map.easeTo` SHALL NOT be invoked

### Requirement: Marker-granularity tweens for cluster transitions

Split and merge animations SHALL tween at the granularity of visible markers (cluster pies for cluster nodes, colored circles for leaf nodes), not at the granularity of every constituent leaf. For a split, the renderer SHALL spawn one temp marker per child of the splitting node, each starting at the parent centroid and tweening to its child centroid. For a merge, the renderer SHALL spawn one temp marker per disappearing visible node, each starting at the disappearing node's centroid and tweening to the new parent centroid. Temp markers for cluster children SHALL be constructed using the same pie-marker primitive as committed cluster markers; temp markers for leaf children SHALL be colored circles matching the tour-type palette. Animation duration SHALL be approximately 250 ms with a cubic ease-out.

#### Scenario: Split spawns one temp marker per direct child, not per leaf

- **GIVEN** a cluster N with two child clusters C1 (3 leaves) and C2 (2 leaves), and N is splitting
- **WHEN** the split animation fires
- **THEN** the renderer SHALL spawn exactly two temp markers (one for C1, one for C2)
- **AND** SHALL NOT spawn five temp markers (one per leaf)

#### Scenario: Merge spawns one temp marker per disappearing visible node

- **GIVEN** two visible cluster pies C1 and C2 are merging into a new parent P
- **WHEN** the merge animation fires
- **THEN** the renderer SHALL spawn exactly two temp markers, one tweening from C1.centroid → P.centroid and one from C2.centroid → P.centroid

#### Scenario: GL filter excludes animating tour ids

- **WHEN** a temp marker is animating for any tour id `t`
- **THEN** the GL `tours-circles` and `tours-circles-selected` layer filters SHALL exclude `t` for the duration of the animation
- **AND** SHALL re-include `t` immediately when the animation completes

### Requirement: Unified state-diff engine drives both zoom-driven and data-driven changes

The renderer SHALL implement a single state-diff engine that, on every change to either the cluster tree or the current zoom, computes the new forest (forest cut of the tree at the new zoom), diffs it against the previously committed visible state, and emits one of three transition kinds for each affected node: appeared, disappeared, or updated. For each appeared and disappeared node, the engine SHALL classify the cause as zoom-driven (an ancestor or descendant relationship to the previous state exists in the new tree) or data-driven (no such relationship), and SHALL select the corresponding animation: zoom-driven uses the merge / split tween; data-driven uses opacity fade-in / fade-out at the node's own centroid. Updated nodes (still visible but with a changed centroid or leaf set) SHALL tween their marker position from old to new centroid and re-render any pie-chart counts in place.

#### Scenario: Realtime tour add absorbed into existing cluster

- **GIVEN** a visible cluster pie C exists at zoom Z
- **WHEN** an external `updateTours` adds a new tour T whose tree placement at zoom Z assigns T to C
- **THEN** a temp colored dot for T SHALL animate from T's coordinates to C's new centroid
- **AND** C's marker SHALL tween its position from the old centroid to the new weighted centroid
- **AND** C's pie SVG SHALL re-render with updated counts

#### Scenario: Realtime tour add as a brand-new individual

- **WHEN** an external `updateTours` adds a tour T that is not clustered with any existing tour at the current zoom
- **THEN** T's GL circle SHALL fade in at its position via opacity transition
- **AND** no merge animation SHALL fire

#### Scenario: Tour deletion fades out

- **WHEN** an external `updateTours` removes a tour T that was visible as an individual circle
- **THEN** T's GL circle SHALL fade out at its position
- **AND** no merge or split animation SHALL fire

#### Scenario: Tour deletion shrinks a cluster

- **GIVEN** a visible cluster pie C of three leaves, one of which is tour T
- **WHEN** an external `updateTours` removes T
- **THEN** C's pie SVG SHALL re-render with the new total and counts
- **AND** C's marker SHALL tween its position from the old centroid to the new weighted centroid

#### Scenario: Mid-gesture data update cancels in-flight tweens and re-diffs

- **GIVEN** a split animation is in flight for cluster N during a user zoom gesture
- **WHEN** an external `updateTours` arrives
- **THEN** the in-flight tween SHALL be cancelled and its temp marker SHALL be removed
- **AND** the renderer SHALL recompute the forest from the new tree at the current zoom
- **AND** SHALL diff against the previously committed visible state and animate accordingly

### Requirement: GL `tours` source does not cluster

The MapLibre GL `tours` GeoJSON source SHALL be configured with `cluster: false` (or with no cluster option, which defaults to false). The `tours-circles`, `tours-circles-selected`, and `tours-completed-check` layers SHALL be filtered to the explicit set of currently-visible-as-individual tour ids, computed from the cluster tree's forest cut at the current zoom. There SHALL NOT be any reliance on MapLibre's internal point clustering for cluster behaviour, identity, or transitions.

#### Scenario: Source has no cluster option

- **WHEN** the `tours` source is added to the map
- **THEN** the `addSource` options SHALL NOT include `cluster: true`, `clusterMaxZoom`, or `clusterRadius`

#### Scenario: Layer filter is an explicit visible-id set

- **WHEN** the renderer commits a new visible state
- **THEN** each of `tours-circles`, `tours-circles-selected`, and `tours-completed-check` SHALL have its filter set to an `['in', ['get', 'id'], ['literal', [...visibleIds]]]` form combined with selection / animation exclusions

### Requirement: `splitZoom` is computed from world-meter centroid distance and pixel radius

For every internal tree node N with children C1 and C2, the `splitZoom` SHALL be computed as the zoom at which the projected pixel distance between `C1.centroid` and `C2.centroid` equals `CLUSTER_RADIUS = 50` pixels, using the standard Web Mercator pixels-per-meter formula evaluated at the merge node's centroid latitude. The post-build pass SHALL clamp every child's `splitZoom` to be greater than or equal to its parent's `splitZoom`, propagating recursively, to guarantee monotone visibility transitions during a continuous zoom.

#### Scenario: Two tours 100 m apart at latitude 47° have a deterministic `splitZoom`

- **GIVEN** two tour leaves at the same latitude 47.0° and exactly 100 m apart
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be the unique solution of `pixelDist = 50` per the Web Mercator formula
- **AND** the value SHALL be reproducible across builds for the same input

#### Scenario: Monotonicity clamp preserves child >= parent

- **GIVEN** centroid linkage produced a node N with `splitZoom = 9.0` whose parent P has `splitZoom = 9.5`
- **WHEN** the post-build clamp runs
- **THEN** `N.splitZoom` SHALL be set to `9.5` (or any value `>= 9.5`)

#### Scenario: Two tours at identical coordinates have effectively infinite `splitZoom`

- **GIVEN** two tour leaves at identical coordinates (distance = 0)
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be greater than `map.getMaxZoom()`
- **AND** clicking that cluster SHALL spiderfy

### Requirement: Reduced motion bypasses all marker tweens

When `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true, the renderer SHALL apply state diffs instantly: no temp marker animations, no opacity fades, no centroid tweens. Marker creation, removal, and centroid updates SHALL commit on the same frame as the diff.

#### Scenario: Threshold crossing with reduced motion enabled

- **GIVEN** `prefers-reduced-motion: reduce` is set
- **WHEN** the user zooms past a `splitZoom` threshold
- **THEN** no `requestAnimationFrame` tween SHALL be scheduled
- **AND** the cluster pie SHALL be removed and the child markers SHALL appear within the same frame as the threshold crossing
