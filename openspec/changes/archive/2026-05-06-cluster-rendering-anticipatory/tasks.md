## 1. Branch context

- [x] 1.1 Verify current branch is `feat/22-cluster-overlapping-tour-markers` and working tree is clean before starting (no fresh branch creation — work continues on top of `cluster-overlapping-tour-markers`)

## 2. Dependency + shared config

- [x] 2.1 Add `supercluster` to `package.json` as a direct dependency (`npm install supercluster` and a separate `npm install -D @types/supercluster`); commit the lockfile in lock-step
- [x] 2.2 Extract `CLUSTER_RADIUS` (retune from 32 → 50 px to match Flutter sibling app's tuning), `CLUSTER_MAX_ZOOM`, and a new `CLUSTER_MIN_POINTS` (set to 2 to match MapLibre's default) into module-scoped constants at the top of `tours-marker-layer.ts` so the GL source and the JS index share a single source of truth
- [x] 2.3 Add `SPIDERFY_CIRCLE_RADIUS_PX` (32), `SPIDERFY_SPIRAL_THRESHOLD` (8), `SPIDERFY_SPIRAL_A` (28), `SPIDERFY_SPIRAL_B` (5) to the same constants block

## 3. JS-side cluster index

- [x] 3.1 In `useToursMarkerLayer`, instantiate one `Supercluster` instance per layer-instance (not per call); type its `points` property bag as `{ id: string, tourType: TourType | null, completed: boolean }`
- [x] 3.2 Rebuild the index inside `updateTours` by calling `index.load(toursToGeoJson(tours).features)` whenever the tours array reference or length changes; do not rebuild on selection-only updates
- [x] 3.3 Add an internal `getCurrentSnapshot()` helper that reads `map.getZoom()` and `map.getBounds()`, calls `index.getClusters(bbox, Math.floor(zoom))`, and returns the same `ClusterSnapshot` shape (`Map<clusterId, { lngLat, leafIds }>`) plus a parallel `Map<tourId, individualFeature>` for the non-cluster leaves
- [x] 3.4 Compute per-type counts for each visible cluster by calling `index.getLeaves(clusterId, Infinity, 0)` and summing by `properties.tourType` (with `unknown` bucket for `null`); cache the per-cluster counts keyed by `(clusterId, leafCount)` so repeated reads at the same zoom skip recomputation

## 4. Rewrite cluster-transitions.ts

- [x] 4.1 Replace `snapshotClustersAsync` with a single synchronous `snapshotClusters(index, bbox, zoom)` that returns `Map<clusterId, { lngLat, leafIds }>` populated from `index.getClusters` + `index.getLeaves`
- [x] 4.2 Delete the MapLibre-coupled overload that took `(map, sourceId)` — every caller now passes the JS index instead
- [x] 4.3 Keep `diffSnapshots` unchanged in signature; verify it now produces non-empty `splitLeaves` and `mergeLeaves` because input `leafIds` are populated

## 5. Rewrite cluster sync in tours-marker-layer.ts

- [x] 5.1 Replace `syncClusterMarkers`'s `map.querySourceFeatures(SOURCE_ID, { filter: ['has', 'point_count'] })` call with `getCurrentSnapshot()` from step 3.3; iterate the returned cluster map directly
- [x] 5.2 Subscribe to `move`, `moveend`, `zoom`, `zoomend`, `idle` events to call `syncFromIndex()`; ensure `data` is no longer required for cluster sync (still listened to for individual circle layer interactions)
- [x] 5.3 Drop `pendingClusterIds` exclusion logic from the cluster sync path — synchronous `leafIds` makes merge timing precise; pending-set is only used for in-flight merge animations, unchanged

## 6. Anticipatory pre-staging on zoomstart

- [x] 6.1 On `zoomstart`, capture `currentZoom = map.getZoom()` and a best-effort `targetZoom = currentZoom + Math.sign(zoomDelta)` using the difference between the previous and current zoom values (sign-based heuristic, no MapLibre internals)
- [x] 6.2 Build a predicted snapshot via `snapshotClusters(index, bbox, targetZoom)`
- [x] 6.3 For every cluster in the predicted snapshot not already in the DOM cache, append a pie marker at the predicted lng/lat with the marker root's `opacity: 0` and store it in a `staged: Map<clusterId, ClusterEntry>` cache (separate from the `clusterCache` until reconciled on `zoomend`)
- [x] 6.4 On `zoomend`, take the authoritative snapshot via `getCurrentSnapshot()`; for each staged marker that matches the snapshot, move it from `staged` into `clusterCache` and trigger fade-in (set opacity to 1 next animation frame); for each staged marker not in the snapshot, remove it without fade

## 7. Opacity bridge

- [x] 7.1 In `pie-marker.ts`, set the wrapper element's inline style to include `opacity: 0; transition: opacity 200ms ease;` at creation; expose helper functions `fadeIn(el)` and `fadeOut(el, onDone)` driving `opacity` and listening to `transitionend`
- [x] 7.2 In `tours-marker-layer.ts`, when a cluster is added to the `clusterCache` via the non-staged path (e.g. on `idle` reconciliation), call `fadeIn` immediately after append; when removed, call `fadeOut` and `marker.remove()` from the `transitionend` callback (not synchronously)
- [x] 7.3 Add `'circle-opacity-transition': { duration: 200 }` to the paint properties of `tours-circles` and `tours-circles-selected`; add `'icon-opacity-transition': { duration: 200 }` to `tours-completed-check`
- [ ] 7.4 Verify the GL paint transitions interpolate when filters flip (sanity: trigger a manual filter change in dev and observe a smooth opacity change)

## 8. Idle reconciliation safety net

- [x] 8.1 Add `map.on('idle', () => syncFromIndex())` so that any drift between predicted/staged DOM and final tile state is corrected within one frame after tiles settle

## 9. Spiderfy for un-expandable clusters

- [x] 9.1 Create `src/features/map/presentation/components/spiderfy.ts` exporting a `Spiderfier` class or factory that owns the active spiderfy state (`activeClusterId`, leaf DOM markers, connector-line GeoJSON)
- [x] 9.2 Implement `computeLeafPositions(centroid, count)`: returns screen-space offsets — circle layout when `count <= SPIDERFY_SPIRAL_THRESHOLD`, Archimedean spiral otherwise
- [x] 9.3 Convert screen-space offsets to lng/lat via `map.unproject(map.project(centroid).add(offset))` for each leaf
- [x] 9.4 Render leaves as DOM markers using the same single-color SVG primitive used for transition temp markers; click invokes `onTourClick`; Enter/Space same
- [x] 9.5 Add a MapLibre `line` layer (`cluster-spiderfy-lines`) backed by a GeoJSON source; populate with one LineString per leaf from leaf-lngLat to centroid-lngLat
- [x] 9.6 In the cluster marker click/keyboard handler in `tours-marker-layer.ts`: call `getClusterExpansionZoom`; if returned zoom `<= map.getZoom()`, invoke `spiderfier.spiderfy(clusterId, centroid, leaves)` instead of `easeTo`
- [x] 9.7 Wire despiderfy triggers: `map.on('movestart' | 'zoomstart', () => spiderfier.collapse())`, document-level Escape key listener while a spiderfied leaf has focus, click on a different cluster
- [x] 9.8 Manage focus order: on spiderfy, move focus to the first leaf marker; on Escape collapse, return focus to the cluster pie marker
- [x] 9.9 Wire `spiderfier.collapse()` into `cleanup()` so style reload + unmount tear down spiderfy state cleanly

## 10. Coverage hull on hover/focus

- [x] 10.1 Create `src/features/map/presentation/components/cluster-hull-layer.ts` exporting `setupHullLayers(map)` and a `showHull(clusterId)` / `clearHull()` API; install one `geojson` source `cluster-hull` plus a `fill` and `line` layer keyed off it
- [x] 10.2 Add an inline Andrew's monotone-chain convex-hull function `convexHull(points: [number, number][]): [number, number][]` (~30 lines, no dep)
- [x] 10.3 In `tours-marker-layer.ts`, on cluster DOM marker creation: attach `pointerenter` / `pointerleave` and `focus` / `blur` handlers; gate by `window.matchMedia('(hover: hover)').matches`
- [x] 10.4 On `pointerenter` / `focus`: read leaves from JS index, compute hull, call `showHull` with the polygon ring; debounce by ~30 ms to absorb rapid pointer crossings
- [x] 10.5 On `pointerleave` / `blur`: call `clearHull()`
- [x] 10.6 Pull hull style values from a single `MAP_HULL_STYLE` constant aligned with `theme/tokens.css` (blue accent fill at ~10% opacity, accent stroke at 2 px)
- [x] 10.7 Handle degenerate hulls: 1 leaf → no hull; 2 leaves → render LineString in `cluster-hull` source instead of Polygon (fill layer remains hidden via `filter: ['==', '$type', 'Polygon']`)

## 11. Remove dead code

- [x] 11.1 Remove `clusterProperties` from the GL source `addSource` call in `setup()`; the JS index now owns per-type counts
- [x] 11.2 Delete the exported `buildClusterProperties` function and its test file `test/features/map/presentation/components/cluster-properties.spec.ts`
- [x] 11.3 Delete the now-unused `snapshotClustersAsync` function and any internal helpers it referenced

## 12. i18n

- [x] 12.1 Add `map.cluster.spiderfyHint` to `src/locales/en.json` (e.g. `"Press Escape to collapse"`) and `src/locales/de-CH.json` (e.g. `"Esc drücken, um zu schliessen"`); use it as the `aria-describedby` text on spiderfied leaves

## 13. Tests

- [x] 13.1 Update `test/features/map/presentation/components/cluster-transitions.spec.ts` to construct a stub Supercluster index (or a real one with synthetic features) and assert `snapshotClusters(index, bbox, zoom)` returns populated `leafIds`
- [x] 13.2 Add a test that the JS-index instance and the GL source `cluster: true` config receive the same radius / max-zoom / min-points constants (read from the shared module constants directly)
- [x] 13.3 Add a test for the anticipatory staging path: stage a marker on `zoomstart`, confirm it has opacity 0; reconcile with a snapshot containing it → opacity 1; reconcile with a snapshot not containing it → marker removed and never reached opacity > 0
- [x] 13.4 Add a test for the opacity bridge: creating a marker via the non-staged path appends it with opacity 0 and schedules a fade-in via `requestAnimationFrame`; removing fades to 0 and calls `remove()` only on `transitionend`
- [x] 13.5 Update `test/features/map/presentation/components/tours-marker-layer.spec.ts` so the stub map exposes `getZoom`, `getBounds`, `on('idle' | 'zoomstart' | 'zoomend' | 'move' | 'moveend')`, and assert the cluster sync no longer reads from `querySourceFeatures` for cluster features (it may still be called for individuals; tighten the assertion)
- [x] 13.6 Add `test/features/map/presentation/components/spiderfy.spec.ts`: cover circle layout for n=2,4,8 (angles evenly distributed, radius constant), spiral layout for n=12,20 (radius monotonically increases), collapse-on-collapse-trigger clears DOM and connector source
- [x] 13.7 Add `test/features/map/presentation/components/cluster-hull-layer.spec.ts`: convex hull of 4 colinear points produces a degenerate (line) hull; convex hull of a square's 4 corners produces those 4 corners in order; hover-disabled environment (`matchMedia('(hover: hover)').matches === false`) does not call `showHull`
- [x] 13.8 Run `npm run test`; all suites green

## 14. Manual verification

- [ ] 14.1 Reproduce the original four defects on `main` of the prior change for baseline; then re-run on this branch and verify each is gone (split animation on first zoom, merge animation on first zoom-out, no flicker between cluster and individuals, no double-render)
- [ ] 14.2 Rapidly zoom in and out 5+ times in a row; verify no orphan DOM markers, no console errors, and visual continuity throughout
- [ ] 14.3 Toggle OS-level reduced-motion on; verify cross-fade is also skipped (instant swap), cluster pies still render, no animation
- [ ] 14.4 Switch map style (Base ↔ Classic) while a cluster is visible; verify `cleanup()` removes staged + cached markers and the new style rebuilds correctly
- [ ] 14.5 Throttle network in devtools to 3G and zoom; verify the opacity bridge masks the slower tile-load and the user never sees an empty intermediate frame
- [ ] 14.6 Seed two tours at identical coordinates; verify clicking the cluster spiderfies them (circle layout, 2 leaves), each leaf is independently clickable, and the cluster collapses on map pan
- [ ] 14.7 Seed 12 tours within ~30 m of each other at max zoom; verify spiderfy uses spiral layout, all 12 leaves are visible without overlap, Escape collapses
- [ ] 14.8 Hover a cluster on a desktop: verify the convex-hull polygon appears around the leaves and clears on pointer leave; verify no hull on a touch-only device or with `matchMedia('(hover: hover)')` reporting false (force via DevTools)

## 15. Finalize

- [x] 15.1 Run `npx eslint . --fix`; ensure zero warnings
- [x] 15.2 Run `npm run type-check` and `npm run test`; all green
- [ ] 15.3 Prompt user to commit with conventional message, e.g. `refactor(map): drive cluster rendering from JS supercluster index with anticipatory transitions, spiderfy + hull (#22)`
- [ ] 15.4 Prompt user to push the branch (already pushed) and either fold this commit into the existing PR for #22 or open a follow-up PR referencing #22 — user's choice
