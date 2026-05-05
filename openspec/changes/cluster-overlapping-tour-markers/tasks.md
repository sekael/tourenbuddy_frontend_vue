## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/22-cluster-overlapping-tour-markers`

## 2. Source clustering wiring

- [x] 2.1 In `src/features/map/presentation/components/tours-marker-layer.ts`, switch the `tours` GeoJSON source to `cluster: true` with `clusterMaxZoom` slightly below MapLibre default and `clusterRadius` derived from the single-circle radius (start at 32 px)
- [x] 2.2 Programmatically build `clusterProperties` from the `TourType` enum (one count expression per type plus an `unknown` bucket for null) so adding a new tour type cannot drift from cluster aggregation
- [x] 2.3 Add `['!', ['has', 'point_count']]` to the filters of `tours-circles`, `tours-circles-selected`, and `tours-completed-check` so cluster features no longer render via the circle/symbol layers
- [x] 2.4 Verify `tours-preview` source remains non-clustered (preview is a single tentative point)

## 3. Cluster DOM marker rendering

- [x] 3.1 Add a `pie-marker.ts` helper in `src/features/map/presentation/components/` that builds an SVG element from a `Record<TourType | 'unknown', number>` count map, total count, and palette; returns the element plus an `update(counts, total)` function so existing markers can be mutated in place
- [x] 3.2 Compute slice paths via polar-to-cartesian + arc flag; handle the single-type case (one slice = full circle) without a degenerate path
- [x] 3.3 Render a centered count label readable on any palette color (white fill with subtle dark stroke or backdrop disc — pick during implementation)
- [x] 3.4 Set `role="button"`, `tabindex="0"`, `aria-label` from `t('map.cluster.label', { count })`
- [x] 3.5 In `useToursMarkerLayer`, maintain `Map<clusterId, { marker: maplibregl.Marker, update: ... }>`. On `data` and `moveend`, call `map.querySourceFeatures('tours', { filter: ['has', 'point_count'] })`, diff against the cache, create/update/remove markers
- [x] 3.6 On click / Enter / Space on a cluster marker, call `(source as GeoJSONSource).getClusterExpansionZoom(clusterId)` then `map.easeTo({ center, zoom })`
- [x] 3.7 Add a `cleanup()` exported from `useToursMarkerLayer` that removes all cached markers; wire it from `tourenbuddy-map.vue` before `setStyle` and on `onUnmounted`

## 4. Split / merge transitions

- [x] 4.1 Add a `cluster-transitions.ts` helper with `snapshotClusters(map, source)` returning `Map<clusterId, { lngLat, leafIds }>` (uses `querySourceFeatures` + cached `getClusterLeaves`)
- [x] 4.2 In `useToursMarkerLayer`, hook `zoomstart` to refresh the previous-cluster snapshot, and `zoomend` to diff against the new state and produce two lists: `splitLeaves: { tourId, fromLngLat }[]` and `mergeLeaves: { tourId, toLngLat, parentClusterId }[]`
- [x] 4.3 Maintain `animatingIds: Set<string>` and `pendingClusterIds: Set<number>`; extend the circle / completed / selected layer filters to exclude `animatingIds`; skip cluster DOM creation for `pendingClusterIds` in the diff loop
- [x] 4.4 Implement a small `animateMarker(el, fromLngLat, toLngLat, durationMs, map)` using `requestAnimationFrame` + cubic ease-out; updates `marker.setLngLat` per frame; returns a cancel handle
- [x] 4.5 Render temp leaf markers using a single-color SVG (tour type color, same palette as the pie slices) reusing primitives from `pie-marker.ts`
- [x] 4.6 On animation complete: remove temp marker, drop id from set, refresh filters, and (for merges) drop the cluster id from `pendingClusterIds` so the pie renders
- [x] 4.7 On `zoomstart`, cancel any in-flight animations, remove all temp markers, and clear both sets
- [x] 4.8 Gate the entire transition machinery behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches === false`; when reduced motion, fall back to instant swap (no temp markers, no filter exclusions)
- [x] 4.9 Ensure `cleanup()` also removes any temp animation markers and cancels rAF handles

## 5. i18n

- [x] 5.1 Add `map.cluster.label` to `src/locales/en.json` (e.g. `"Cluster of {count} tours"`) and `src/locales/de-CH.json` (e.g. `"Cluster aus {count} Touren"`); confirm no existing key already covers this
- [x] 5.2 Inject via `const { t } = useI18n({ useScope: 'global' })` per project conventions

## 6. Tests

- [x] 6.1 Unit test the slice-angle / path generator in `test/features/map/presentation/components/pie-marker.spec.ts` — cover: empty counts (no marker created), single-type (full circle), two equal types (two halves), three unequal types (sum to 360°), null `tourType` contributing to the `unknown` slice
- [x] 6.2 Unit test the cluster-property expression builder — adding a hypothetical new `TourType` produces a corresponding aggregation entry
- [x] 6.3 Component-level test for `useToursMarkerLayer` cluster diffing using a stub map that exposes `querySourceFeatures` — assert markers are created on first `data`, updated when counts change, removed on cleanup
- [x] 6.4 Unit test the split/merge diff in `cluster-transitions.ts` against fixed before/after snapshots — split list non-empty when a parent cluster's leaves become individuals; merge list non-empty when individuals enter a new cluster; mid-zoom interrupt clears both sets
- [x] 6.5 Test reduced-motion gate: when `matchMedia` reports reduce, no temp markers are created and filters are not extended

## 7. Manual verification

- [ ] 7.1 In dev, seed two ski + two mountaineering tours within ~50 m of each other; verify a half-blue / half-red cluster with `4` label appears, splits on zoom-in with fan-out animation, re-aggregates on zoom-out with collapse animation
- [ ] 7.2 Verify completed-tour check glyph still renders for non-clustered completed tours and is absent (or expected behavior) when those tours are inside a cluster
- [ ] 7.3 Verify edit-mode preview marker still renders unchanged
- [ ] 7.4 Verify style switch (Base ↔ Full Color) does not leave orphan cluster or temp animation DOM markers
- [ ] 7.5 Toggle OS-level reduced-motion preference; verify markers swap instantly with no animation and no orphan nodes
- [ ] 7.6 Rapidly zoom in/out repeatedly; verify no orphan DOM markers remain after motion stops

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix` (project rule: never `npm run format`); ensure zero warnings
- [x] 8.2 Run `npm run type-check` and `npm run test`; all green
- [ ] 8.3 Prompt user to commit using a ready-to-copy conventional commit message, e.g. `feat(map): cluster overlapping tour markers as pie chart (#22)`
- [ ] 8.4 Prompt user to push the branch and open a PR; reference issue #22 in the PR body
