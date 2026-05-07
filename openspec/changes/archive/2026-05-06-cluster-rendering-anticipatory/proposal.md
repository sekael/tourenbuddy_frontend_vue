## Why

The clustering pipeline introduced by `cluster-overlapping-tour-markers` ships with four rendering bugs surfaced during manual verification (issue #22 follow-up): split animations never fire, merge animations skip the first zoom, individual circles flicker before cluster pies appear after a zoom, and at tile-load boundaries individual markers and their cluster can be visible simultaneously. The root cause is shared: cluster state is read from `map.querySourceFeatures` (rendered tiles) rather than from an authoritative synchronous source, and the snapshot taken on `zoomstart` lacks `leafIds`. Symptom-by-symptom patching will keep racing the tile pipeline; we need to move authority off the tiles.

## What Changes

- Add `supercluster` as a JS-side authoritative cluster index, mirroring the MapLibre source clustering config (radius, `maxZoom`).
- Drive every cluster DOM marker — creation, update, removal — from the JS index, not from `querySourceFeatures`.
- Keep the MapLibre source clustering for the GL circle layer; cluster features remain filtered out of the circle/symbol layers as today.
- Snapshots in `cluster-transitions.ts` derive `lngLat` and `leafIds` from the JS index synchronously (fixes split + merge animation bugs).
- On `zoomstart`, pre-compute clusters at the *target* zoom (best-effort: current zoom +/- predicted delta) and create destination DOM markers at opacity 0 so they exist in the DOM before the GL repaint lands.
- Add CSS `transition: opacity` on cluster DOM markers and `circle-opacity-transition: { duration: 200 }` on GL circle layers so the brief tile-state mismatch fades instead of flashing.
- Reconcile against the JS index on `idle` to clean up any drift after tiles settle.
- Bump `CLUSTER_RADIUS` from 32 px → 50 px to align with the Flutter sibling app's tuning and reduce over-eager declustering at country-level zoom.
- Add **spiderfy** for clusters that cannot expand further (`getClusterExpansionZoom(clusterId) <= currentZoom`, e.g. identical-coordinate tours): on cluster activation, fan leaves out in a circle (≤8 leaves) or Archimedean spiral (>8) using DOM markers, with a connector line back to the cluster centroid. Despiderfy on map move, escape key, or another cluster activation. Removes the "stuck cluster at max zoom" limitation accepted by the prior change.
- Add **coverage hull on hover/focus** for cluster markers: a MapLibre fill+line layer renders the convex hull of the cluster's leaf coordinates while the cluster marker is hovered or keyboard-focused; clears on leave/blur. Leaf coordinates come from the JS index synchronously.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `map-integration`: cluster rendering pipeline switches from MapLibre-tile-driven (`querySourceFeatures`) to JS-supercluster-driven authoritative state with anticipatory next-zoom precomputation and opacity-bridge transitions. Single-tour rendering, completed-check overlay, preview marker, and selection behavior remain unchanged in spec terms; only the cluster pathway is restructured.

## Impact

- `src/features/map/presentation/components/tours-marker-layer.ts` — replaces `querySourceFeatures`-based sync with JS-supercluster-driven sync; adds anticipatory precompute on `zoomstart`; adds opacity-bridge styles on circle layers; wires spiderfy + coverage-hull layers and their event handlers.
- `src/features/map/presentation/components/cluster-transitions.ts` — `snapshotClusters` becomes a sync read from the JS index returning `lngLat` + `leafIds` together; `snapshotClustersAsync` and the `getClusterLeaves` callback path are removed.
- `src/features/map/presentation/components/pie-marker.ts` — wrapper element gains an opacity transition style; small API addition for fade-in/out helpers.
- New file: `src/features/map/presentation/components/spiderfy.ts` — circle-vs-spiral leaf layout, connector lines, despiderfy triggers.
- New file: `src/features/map/presentation/components/cluster-hull-layer.ts` — convex-hull computation + MapLibre fill+line layer wiring.
- New runtime dependency: `supercluster` (~12 KB, transitive via maplibre-gl already, but added as a direct dep for explicit ownership). No additional dep for hull (use an inline Andrew's monotone-chain implementation, ~30 lines).
- New i18n key for spiderfied leaf accessible name (e.g. `map.cluster.spiderfyHint` — "Press Escape to collapse"); `de-CH.json` matched.
- Tests updated: `cluster-transitions.spec.ts` rewritten against the JS-index snapshot signature; new tests for anticipatory precompute, opacity-bridge gate, spiderfy layout, and hull computation.
- No backend or schema impact.
- Builds on top of `cluster-overlapping-tour-markers` (same branch `feat/22-cluster-overlapping-tour-markers`); ships in the same PR or as a follow-up commit on that branch — git workflow tasks are not duplicated here.
