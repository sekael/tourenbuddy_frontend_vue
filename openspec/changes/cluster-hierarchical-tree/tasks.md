## 1. Branch context

- [x] 1.1 Verify current branch is `feat/22-cluster-overlapping-tour-markers` and working tree is clean before starting

## 2. Dependency removal + constants cleanup

- [x] 2.1 `npm uninstall supercluster @types/supercluster` and commit `package.json` + `package-lock.json` together
- [x] 2.2 Remove `CLUSTER_MAX_ZOOM` and `CLUSTER_MIN_POINTS` exports from `src/features/map/presentation/components/tours-marker-layer.ts`; keep `CLUSTER_RADIUS = 50`
- [x] 2.3 Remove the `Supercluster` import and `Supercluster<...>` instance + `indexReady` flag from `tours-marker-layer.ts`
- [x] 2.4 Update `test/features/map/presentation/components/cluster-transitions.spec.ts` to drop assertions on `CLUSTER_MAX_ZOOM` / `CLUSTER_MIN_POINTS` constants

## 3. Cluster tree module

- [x] 3.1 Create `src/features/map/presentation/components/cluster-tree.ts`
- [x] 3.2 Define `TreeNode` types: `LeafNode { kind: 'leaf', id: string, coord: [number, number], tourType: TourType | null }` and `InternalNode { kind: 'internal', id: string, centroid: [number, number], leafIds: string[], children: [TreeNode, TreeNode], splitZoom: number, totalLeafCount: number }`
- [x] 3.3 Implement `pixelsPerMeter(latDeg: number, zoom: number): number` matching the Web Mercator formula `(256 * 2^zoom) / (40075016.686 * cos(lat * π/180))`
- [x] 3.4 Implement `solveSplitZoom(distMeters: number, latDeg: number, radiusPx: number): number` returning `log2((radiusPx * 40075016.686 * cos(lat)) / (256 * distMeters))`. Return `+Infinity` when `distMeters === 0`.
- [x] 3.5 Implement `haversineMeters(a: [number, number], b: [number, number]): number` (or import from `core/utils` if equivalent already exists)
- [x] 3.6 Implement `buildClusterTree(tours: Tour[], radiusPx: number = CLUSTER_RADIUS): TreeNode | null` using greedy closest-pair agglomerative clustering: maintain an active set of nodes, recompute weighted centroid on merge, repeat until one root remains. For an empty tour list return `null`; for a single tour return the leaf.
- [x] 3.7 Implement the post-build monotonicity clamp: walk the tree top-down and ensure `child.splitZoom >= parent.splitZoom` for every internal child; when adjusting, propagate recursively to descendants
- [x] 3.8 Implement `cutForest(root: TreeNode | null, zoom: number, bbox?: [number, number, number, number]): TreeNode[]` returning the visible nodes at the given zoom; when `bbox` is supplied, omit nodes whose centroid lies outside it
- [x] 3.9 Implement `collectSplitZooms(root: TreeNode | null): number[]` returning the sorted ascending list of all internal-node `splitZoom` values, used by the threshold-crossing detector
- [x] 3.10 Implement `findCrossings(splitZooms: number[], fromZoom: number, toZoom: number): number[]` returning the subset of `splitZooms` strictly between the two values (exclusive of `fromZoom`, inclusive of `toZoom` toward direction of motion)

## 4. Tree tests

- [x] 4.1 Create `test/features/map/presentation/components/cluster-tree.spec.ts`
- [x] 4.2 Test `buildClusterTree([])` returns `null`
- [x] 4.3 Test `buildClusterTree([oneTour])` returns the leaf as the root
- [x] 4.4 Test that two tours with known coordinates produce an internal node whose `splitZoom` matches the manual calculation of `solveSplitZoom`
- [x] 4.5 Test that for a small cluster of 4 tours, the tree's structure matches the expected greedy-closest-pair order (use coordinates spaced so the order is unambiguous)
- [x] 4.6 Test the monotonicity clamp using a synthetic node whose child violates the invariant; verify the clamp raises the child to parent.splitZoom
- [x] 4.7 Test that `cutForest(root, z)` returns the root when `z < root.splitZoom` and returns all leaves when `z >= max(splitZoom)`
- [x] 4.8 Test that `cutForest(root, z, bbox)` filters out nodes whose centroid is outside `bbox`
- [x] 4.9 Test `findCrossings(splitZooms, from, to)` for both zoom-in and zoom-out cases, including no-crossings and multi-crossing scenarios
- [x] 4.10 Test that two tours at identical coordinates produce an internal node with `splitZoom > 22` (effectively infinity for any sane map)

## 5. Animation primitives reuse

- [x] 5.1 Verify `animateMarker(marker, from, to, durationMs, onComplete)` in `tours-marker-layer.ts` is reusable as a private helper; if the function still references Supercluster types, simplify it
- [x] 5.2 Verify `makeDotEl(color)` is unchanged and exported (or kept private as needed)
- [x] 5.3 Add an internal helper `makePieTempEl(node: InternalNode): HTMLElement` that constructs a non-interactive pie marker element via `createPieMarkerElement` for use as a temp marker (no click/keydown handlers, opacity 1)

## 6. State-diff engine

- [x] 6.1 In `tours-marker-layer.ts`, define `RenderedNode = { id: string, kind: 'leaf' | 'internal', centroid: [number, number], leafIds: string[] }` and a `lastFrame: { tree: TreeNode | null, zoom: number, byNodeId: Map<string, RenderedNode> }` state container
- [x] 6.2 Implement `commitFrame(newTree, newZoom)` that computes `forest = cutForest(newTree, newZoom, mapBbox())`, builds `newByNodeId`, classifies each diff item, dispatches the corresponding animation, then assigns `lastFrame = { newTree, newZoom, byNodeId: newByNodeId }`
- [x] 6.3 Implement `classifyAppeared(node, oldByNodeId, newTree)`: returns `{ kind: 'split-from', sourceCentroid }` when an ancestor of `node` exists in `oldByNodeId` (the previous parent has split); otherwise returns `{ kind: 'created' }`
- [x] 6.4 Implement `classifyDisappeared(node, oldByNodeId, newTree)`: returns `{ kind: 'merged-into', targetCentroid }` when a node containing `node.leafIds` exists in the new forest (the new parent has absorbed it); otherwise returns `{ kind: 'deleted' }`
- [x] 6.5 Implement `classifyUpdated(node, oldByNodeId)`: returns `{ centroidChanged: boolean, leafCountChanged: boolean }` driving the in-place tween + SVG re-render
- [x] 6.6 Wire the four animation primitives — `animateSplitFromCentroid`, `animateMergeToCentroid`, `animateFadeIn`, `animateFadeOut` — using `animateMarker` and the existing `fadeIn` / `fadeOut` from `pie-marker.ts`. Animations skip immediately when reduced-motion is active.
- [x] 6.7 Reduced-motion path: `commitFrame` with `reducedMotion === true` skips all `animateMarker` calls and removes/adds markers without fades; updated nodes snap to new centroid
- [x] 6.8 Track `animatingIds: Set<string>` for tour ids currently inside any tween; the GL `tours-circles*` filter excludes them; clear when the corresponding tween completes

## 7. Rewrite `tours-marker-layer.ts` rendering pipeline

- [x] 7.1 Replace the Supercluster-based `getCurrentSnapshot` with a direct call to the tree + `cutForest`
- [x] 7.2 Remove the `staged: Map<...>` and all anticipatory-staging functions (`stageAnticipatory`, `reconcileStaged`)
- [x] 7.3 Replace `syncFromIndex` with `commitFrame(tree, map.getZoom())`; call it from `move`, `moveend`, `zoom`, `idle`
- [x] 7.4 Replace `runTransitions` with the diff engine's classification path (no separate split/merge code path)
- [x] 7.5 In the `addSource(SOURCE_ID, ...)` call, drop `cluster: true`, `clusterMaxZoom`, `clusterRadius` (already done in earlier work — re-verify)
- [x] 7.6 Maintain `lastSampledZoom` updated on every `zoom` event; use `findCrossings(splitZooms, lastSampledZoom, currentZoom)` to know which nodes' `splitZoom` was crossed in this tick (used by classification to pick zoom-driven vs data-driven)
- [x] 7.7 Update the cluster click handler: replace `getClusterExpansionZoom`-based logic with `node.splitZoom > map.getMaxZoom() ? spiderfier.spiderfy(node) : map.easeTo({ center: node.centroid, zoom: node.splitZoom + 0.01 })`
- [x] 7.8 Update `updateTours(tours, selectedId)` to: cancel in-flight animations, build new tree, commit a new frame at the current zoom using the diff engine, refresh GL filters, set GeoJSON source data
- [x] 7.9 In `cleanup()`, in addition to the existing teardown, clear `lastFrame` and the tree reference

## 8. Reshape `cluster-transitions.ts`

- [x] 8.1 Remove the `ClusterIndex` interface and the `snapshotClusters(index, bbox, zoom)` function
- [x] 8.2 Either delete the file entirely or replace its exports with `diffForests(oldByNodeId, newForest)` returning `{ appeared, disappeared, updated }`
- [x] 8.3 Update `test/features/map/presentation/components/cluster-transitions.spec.ts` accordingly: rewrite all tests to operate over the new diff API and tree-derived forests

## 9. Spec sync for the modified GL layer config

- [x] 9.1 Verify `pie-marker.ts` retains the `fadeOut` `transitionend` + setTimeout fallback hardening already applied
- [x] 9.2 Update `test/features/map/presentation/components/tours-marker-layer.spec.ts`: assert the source is added without `cluster: true`; assert the cluster sync code path does not import or reference `Supercluster`; tighten the existing "no querySourceFeatures with cluster filter" assertion (already in place)

## 10. Manual verification against known bugs

- [ ] 10.1 Reproduce the "sticky cluster markers" recording (clustered-markers-sticky*.png) from main; verify on this branch that no leftover cluster markers remain after zooming through any number of integer zoom levels
- [ ] 10.2 Reproduce the "expand-during-zoom-out" recording (Screen Recording 2026-05-06 at 13.09.59.mov); verify that during a continuous zoom-out, no cluster ever splits back into individuals
- [ ] 10.3 Reproduce the "late animation" symptom; verify the fan-out animation is visible during the zoom gesture, not after
- [ ] 10.4 Manually invoke `useToursMarkerLayer.updateTours` from devtools while a zoom gesture is in progress; verify the in-flight animation is cancelled and the new tour list animates in correctly
- [ ] 10.5 Manually delete a tour from the list while a cluster pie is visible; verify the pie's count decreases, its centroid tweens, and no flicker occurs
- [ ] 10.6 Toggle OS-level reduced-motion on; verify no tweens fire on threshold crossings or on data updates (instant snap)
- [ ] 10.7 Switch map style (Base ↔ Classic) while a cluster is visible; verify `cleanup()` tears down state and the new style rebuilds correctly

## 11. Lint, type-check, tests

- [x] 11.1 Run `npx eslint . --fix --ignore-pattern flutter-cluster-markers.md`; ensure zero warnings
- [x] 11.2 Run `npm run type-check`; ensure clean
- [x] 11.3 Run `npm run test`; all suites green

## 12. Finalize

- [ ] 12.1 Prompt user to commit with conventional message, e.g. `refactor(map): drive clustering from a hierarchical tree with monotone identity and threshold-driven animations (#22)`
- [ ] 12.2 Prompt user to push and choose PR strategy (fold into existing PR #22 or open a new PR superseding it)
