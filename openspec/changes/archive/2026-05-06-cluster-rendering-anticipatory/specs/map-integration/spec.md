## ADDED Requirements

### Requirement: Cluster transitions are visually continuous

While the user is zooming or panning past a cluster collision boundary, the visible state on screen SHALL remain continuous: at no point SHALL the same tour be visible as both an individual circle and a constituent of a cluster pie at full opacity, and at no point SHALL a perceptible empty frame occur between the disappearance of one representation and the appearance of the next. The implementation SHALL bridge any residual transition gap with an opacity cross-fade no longer than 250 ms applied jointly to the GL circle layers and the cluster DOM markers.

#### Scenario: Zoom-in cross-fades cluster pie out as individual circles fade in

- **WHEN** a zoom-in causes a cluster to dissolve into individual tour markers
- **THEN** the cluster pie's opacity SHALL transition from 1 to 0 while the individual circles' opacity transitions from 0 to 1 over a single window no longer than 250 ms
- **AND** at no frame during the transition SHALL both representations of the same tour be at full opacity simultaneously

#### Scenario: Zoom-out cross-fades individual circles out as cluster pie fades in

- **WHEN** a zoom-out causes individual tour markers to be aggregated into a cluster
- **THEN** the individual circles' opacity SHALL transition from 1 to 0 while the cluster pie's opacity transitions from 0 to 1 over a single window no longer than 250 ms
- **AND** at no frame during the transition SHALL both representations of the same tour be at full opacity simultaneously

#### Scenario: Tile-load latency does not cause empty frames

- **WHEN** a zoom completes but the underlying GL tile data is still settling for one or more frames
- **THEN** the cluster DOM markers SHALL already be present in the DOM at the destination zoom (created in advance), so the user SHALL NOT see an empty intermediate frame between the prior state's fade-out and the destination state's appearance

### Requirement: Cluster authoritative state derives from a synchronous JS index

Cluster DOM marker creation, update, removal, split-detection, and merge-detection SHALL be driven from a synchronous in-memory cluster index (e.g. a `supercluster` instance) whose state is a deterministic pure function of the loaded tour set, the current zoom level, and the current map bounds. Reads from the rendered GL tile state (e.g. `map.querySourceFeatures` for cluster features) SHALL NOT be the source of truth for cluster DOM rendering. The JS index SHALL be configured with the same clustering parameters (collision radius, max zoom, minimum points per cluster) as the GL source clustering used by the circle-layer filters; configuration drift between the two SHALL be prevented by sharing a single source of those parameters.

#### Scenario: Cluster split animation fires on the first zoom of a session

- **GIVEN** the user has just loaded the map with overlapping tours that aggregate into a cluster
- **WHEN** the user performs the first zoom-in that causes the cluster to dissolve
- **THEN** the split fan-out animation SHALL fire for every leaf tour exiting the cluster, with `leafIds` derived synchronously from the JS index (not requiring a prior asynchronous `getClusterLeaves` round-trip)

#### Scenario: Cluster merge animation fires on the first zoom-out of a session

- **GIVEN** the user has just loaded the map with tours rendered as individual circles
- **WHEN** the user performs the first zoom-out that causes those tours to enter a new cluster
- **THEN** the merge collapse animation SHALL fire for every leaf tour entering the cluster

#### Scenario: Configuration parameters do not drift

- **WHEN** the JS cluster index and the GL source clustering are constructed
- **THEN** they SHALL receive identical values for collision radius, max zoom, and minimum points per cluster, sourced from the same module-level constants

### Requirement: Anticipatory destination markers staged on zoomstart

On `zoomstart`, the renderer SHALL pre-stage the destination cluster DOM markers — those expected to exist after the zoom completes — by appending them to the DOM at their predicted target lng/lat with opacity 0, before the GL repaint at the target zoom lands. On `zoomend`, the renderer SHALL reconcile the staged set against the authoritative snapshot at the now-final zoom: matching markers fade in to opacity 1; markers staged but not present in the final snapshot SHALL be removed without ever becoming visible; markers absent from staging but present at zoomend SHALL still be created and faded in normally.

#### Scenario: Predicted markers fade in when prediction is correct

- **WHEN** the predicted target zoom matches the actual zoomend zoom
- **THEN** the staged destination markers SHALL transition from opacity 0 to opacity 1 with no additional creation step on zoomend

#### Scenario: Mispredicted markers are removed without becoming visible

- **WHEN** a marker staged on zoomstart is not present in the snapshot at zoomend
- **THEN** that marker SHALL be removed from the DOM without ever transitioning to opacity > 0

#### Scenario: Late-discovered markers fade in normally

- **WHEN** a cluster present at zoomend was not staged on zoomstart (prediction missed it)
- **THEN** the marker SHALL be created at zoomend at opacity 0 and fade in to opacity 1 within the standard cross-fade window

### Requirement: Un-expandable clusters spiderfy on activation

When the user activates a cluster (click, Enter, or Space) whose `getClusterExpansionZoom` returns a zoom less than or equal to the current map zoom, the renderer SHALL fan the cluster's leaves out around the cluster centroid in screen space ("spiderfy") rather than zoom further. Each spiderfied leaf SHALL be an individual interactive marker carrying the same activity-type color and selection behavior as a non-clustered tour marker; thin connector lines SHALL link each leaf back to the cluster centroid. A spiderfied cluster SHALL collapse on the next camera movement, on Escape keypress while any spiderfied leaf has focus, on activation of a different cluster, or on map cleanup.

#### Scenario: Identical-coordinate tours spiderfy

- **GIVEN** two or more tours pinned at the same coordinates that remain clustered at every zoom
- **WHEN** the user clicks the cluster
- **THEN** the leaves SHALL be rendered as separate markers fanned around the centroid
- **AND** each SHALL be individually clickable to invoke the existing tour-selection behavior

#### Scenario: Spiderfy uses circle layout for small clusters

- **WHEN** a cluster being spiderfied contains 8 or fewer leaves
- **THEN** the leaves SHALL be placed on a circle of fixed screen-space radius around the centroid, evenly distributed by angle

#### Scenario: Spiderfy uses spiral layout for large clusters

- **WHEN** a cluster being spiderfied contains more than 8 leaves
- **THEN** the leaves SHALL be placed along an Archimedean spiral around the centroid

#### Scenario: Spiderfy collapses on camera movement

- **WHEN** the user pans or zooms the map while a cluster is spiderfied
- **THEN** the spiderfied leaves and connector lines SHALL be removed and the cluster pie SHALL resume normal rendering

#### Scenario: Spiderfy collapses on Escape

- **WHEN** the user presses Escape while a spiderfied leaf marker has keyboard focus
- **THEN** the spiderfied state SHALL collapse and focus SHALL return to the cluster pie marker

#### Scenario: Expansion-zoomable clusters do not spiderfy

- **WHEN** the user clicks a cluster whose `getClusterExpansionZoom` returns a zoom greater than the current map zoom
- **THEN** the map SHALL `easeTo` the expansion zoom centered on the cluster, as previously specified, with no spiderfy

### Requirement: Cluster coverage hull on hover or focus

While a cluster marker is hovered with a pointing device or has keyboard focus on a hover-capable display, the renderer SHALL render the convex hull of the cluster's leaf coordinates as a translucent polygon overlay on the map, communicating the geographic extent of the cluster's contents. The hull SHALL clear immediately on pointer leave or blur. On devices without hover capability (`(hover: hover)` not satisfied), the hull SHALL NOT render — touch users access the same information via spiderfy instead.

#### Scenario: Hull renders on cluster hover

- **WHEN** a hover-capable pointer enters a cluster marker
- **THEN** a polygon representing the convex hull of the cluster's leaf coordinates SHALL render as a fill+line overlay on the map

#### Scenario: Hull clears on pointer leave

- **WHEN** the pointer leaves the cluster marker
- **THEN** the hull SHALL be removed within one or two frames (debounce window)

#### Scenario: Hull renders on keyboard focus

- **WHEN** the cluster marker receives keyboard focus on a hover-capable device
- **THEN** the hull SHALL render the same as on pointer hover

#### Scenario: Touch device suppresses hull

- **WHEN** the device does not satisfy the `(hover: hover)` media query
- **THEN** the hull SHALL NOT render on any cluster activation; spiderfy SHALL be the only "what's inside" affordance
