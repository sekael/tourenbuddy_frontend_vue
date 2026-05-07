## Why

The current cluster rendering pipeline computes cluster membership via Supercluster *independently at each integer zoom level*. This produces non-monotone behaviour — two tours can be clustered at zoom 10, separate at zoom 11, and clustered again at zoom 12 — which manifests on screen as flicker, sticky leftover markers, and animations that fire in the wrong direction relative to user intent. A user-visible recording on `feat/22-cluster-overlapping-tour-markers` shows clustered markers expanding and re-collapsing during a single zoom-out gesture. The previously-shipped `cluster-rendering-anticipatory` change tried to mask the symptoms with anticipatory staging and an opacity bridge but did not address the root cause.

This change replaces Supercluster as the runtime authority with a **stateful hierarchical agglomerative cluster tree**, built once per tour list change. Every tour belongs to exactly one chain of ancestors; cluster identity is stable across zooms; and rendering at any zoom is a pure cut of the tree. Animation fires only when a node's `splitZoom` is actually crossed, eliminating the flicker class of bugs entirely.

## What Changes

- **BREAKING**: Removes the `supercluster` runtime dependency and its `@types/supercluster` types. The npm package is uninstalled.
- **BREAKING**: Replaces the per-zoom Supercluster snapshot model in `cluster-transitions.ts` with a hierarchical-tree model. The exported `snapshotClusters` and `diffSnapshots` are reshaped to operate over forest cuts instead of Supercluster clusters.
- **BREAKING**: Removes `clusterMaxZoom` / `clusterRadius` configuration on the `tours` GeoJSON source — the source no longer clusters; clustering is fully owned by the JS tree.
- New module `cluster-tree.ts` builds an agglomerative tree (greedy closest-pair merging on world-meter centroid distance) with `splitZoom` per internal node, computed via the inverse of `pixelsPerMeter(lat, zoom) * distanceMeters = CLUSTER_RADIUS`. Includes a monotonicity clamp so `child.splitZoom >= parent.splitZoom` always holds.
- `cluster-tree.ts` exposes `cutForest(tree, zoom)` returning the visible nodes at that zoom (each node carries `centroid`, `leafIds`, and `splitZoom`).
- `tours-marker-layer.ts` is rewritten around a **state-diff engine**: every change to `(tree, zoom)` produces a forest, which is diffed against the previously committed frame's forest. The diff items (appeared / disappeared / updated) drive marker creation, removal, and tweens.
- Animations are **per-threshold**: a sampled `zoom` event detects which `splitZoom` thresholds were crossed since the last sample and fires the corresponding split or merge tween for each. Pan and intra-band zoom produce empty diffs and run zero animations.
- Cluster click navigates to `easeTo(splitZoom + ε)` instead of `getClusterExpansionZoom`. When `splitZoom > map.getMaxZoom()` (e.g. tours at near-identical coordinates), spiderfy as today.
- Animation rendering uses **marker-granularity tweens**: a temp pie marker (or colored dot for leaf children) is constructed and tweened from source centroid to destination centroid. The leaf `makeDotEl` primitive is reused; pie-marker temp markers are constructed via the existing `createPieMarkerElement`.
- The data-driven update pipeline is unified with the zoom pipeline: realtime tour add / delete / edit also produce diffs and animate appropriately. New tours absorbed into a visible cluster fly into its centroid; deleted tours fly out and fade; cluster centroids tween when their leaf set changes.
- Removes the anticipatory staging machinery (`staged` map, `stageAnticipatory`, `reconcileStaged`) — superseded by the deterministic forest-cut model.
- Reduced motion: state changes apply instantly with no tweens or fades.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `map-integration`: replaces the cluster-transitions and anticipatory-staging requirements introduced in `cluster-rendering-anticipatory` with hierarchical-tree-based requirements. Adds requirements for monotone cluster identity, threshold-driven animations, unified data-update animations, and the no-clustering GL source.

## Impact

- Source: `src/features/map/presentation/components/tours-marker-layer.ts` (major rewrite), `src/features/map/presentation/components/cluster-transitions.ts` (reshaped or replaced), new `src/features/map/presentation/components/cluster-tree.ts`. `pie-marker.ts` `fadeOut` keeps its recently-hardened transitionend fallback.
- Tests: `test/features/map/presentation/components/cluster-transitions.spec.ts` rewritten for forest-diff semantics; new `test/features/map/presentation/components/cluster-tree.spec.ts` covers tree construction, `splitZoom` math, monotonicity clamp, and `cutForest`. `tours-marker-layer.spec.ts` updated to assert no Supercluster instance is created.
- Dependencies: `supercluster` and `@types/supercluster` removed from `package.json`.
- Constants: `CLUSTER_MAX_ZOOM` removed (no longer meaningful — the tree's `splitZoom` per node replaces it). `CLUSTER_RADIUS` retained at 50 px. `CLUSTER_MIN_POINTS` removed (a pair of tours is always a candidate cluster).
- No changes to data layer, Supabase schema, routing, or i18n keys.
- No user-visible API or URL changes; behaviour change is the elimination of flicker and the addition of data-driven animations.
