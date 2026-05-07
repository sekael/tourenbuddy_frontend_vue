## Why

When several tours share a region, their circle markers overlap and the user can no longer see how many tours exist there nor click individual markers. Issue #22 asks for collision-aware aggregation that still conveys the activity-type mix at a glance.

## What Changes

- Tour markers cluster automatically when they would overlap at the current zoom level.
- A cluster marker renders as a single circle composed of pie slices, one slice per tour type, sized proportionally to the tour count of that type within the cluster.
- A cluster marker shows the total tour count as a centered numeric label.
- Single (non-colliding) tours render exactly as today (existing circle layer, completed-check icon, selected-state styling).
- Zooming in past the collision threshold splits clusters; remaining colliding tours re-aggregate.
- Clicking a cluster zooms to its expansion zoom (or splits it if already past expansion).
- When a cluster splits on zoom, its leaf markers SHALL animate from the cluster centroid to their real coordinates (fan-out) rather than pop in. Reverse merge (zoom-out) SHALL animate leaves into the cluster centroid before the cluster appears.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `map-integration`: tour marker rendering gains a clustering layer with pie-chart aggregation. Selection, completed-check overlay, and preview-marker behavior remain unchanged for non-clustered points.

## Impact

- `src/features/map/presentation/components/tours-marker-layer.ts` — switch source to `cluster: true`, add `clusterProperties` per tour type, filter circle layers to non-cluster points, manage DOM HTML markers for clusters.
- `src/features/map/presentation/components/tourenbuddy-map.vue` — wire cluster-marker lifecycle (mount/unmount on style reload, sync on `data`/`moveend`).
- `src/features/tours/data/models/tour-type.ts` — colors reused, no change expected.
- New i18n key for cluster aria-label (e.g. `map.cluster.label` with count interpolation).
- Tests under `test/features/map/` for cluster aggregation logic and pie-segment computation.
- No backend or schema impact.
