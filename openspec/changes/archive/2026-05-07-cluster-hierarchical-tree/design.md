## Context

Tour markers cluster on the Swiss topo map to avoid overlap. The current implementation seeds a `Supercluster` JS index from the tour list and queries `index.getClusters(bbox, floor(zoom))` to drive cluster DOM markers, GL-layer filters, and split/merge animations. Supercluster's per-zoom-level computation is internally a fresh kd-bush — there is no notion of stable cluster identity across zooms. Two tours can land in the same cluster at zoom 10 and in different clusters at zoom 11, depending on tile boundaries and pixel-distance edge cases.

The previously-shipped `cluster-rendering-anticipatory` change layered anticipatory marker staging and an opacity bridge on top to mask transition glitches. In testing on `feat/22-cluster-overlapping-tour-markers` we observed three residual classes of bug rooted in this non-monotonicity:
1. **Sticky cluster markers** — pies that stayed on screen indefinitely after their cluster_id ceased to exist in subsequent snapshots (root cause: `fadeOut` no-op when the element was already at opacity 0; this was patched, but the underlying flapping that produced the leak is what we now fix).
2. **Re-expansion during zoom-out** — markers that clustered, then split again as zoom continued in the same direction, because Supercluster's snapshot at the next floor re-grouped them differently.
3. **Late animations** — split fan-outs that played after individuals had already been painted, because the diff was computed at `zoomend` against a stale `prev`.

The user's mental model is hierarchical: every tour is part of one cluster lineage, clusters only split when the user zooms past a defined threshold, and the only thing that should move on screen is what actually changes.

Constraints:
- Scale: tens to low hundreds of tours. No perf budget for thousands.
- Vue 3 + MapLibre GL JS + happy-dom for tests. No SSR.
- Existing `pie-marker.ts`, `spiderfy.ts` are reusable. Existing `tours-circles` / `tours-circles-selected` / `tours-completed-check` GL layers are kept; their filter input changes.

## Goals / Non-Goals

**Goals:**
- Cluster identity is stable: a tour belongs to one cluster lineage that does not change as zoom changes.
- Zoom transitions cause animations *only* when at least one node's `splitZoom` is crossed; pure pan and intra-band zoom are zero-work.
- Animations are visible *during* the gesture, not after it.
- Realtime / external tour add / edit / delete animates with the same primitives, providing a "smooth absorb" UX consistent with eventual consistency.
- Removing the `supercluster` dependency removes one source of two-source-of-truth bugs.

**Non-Goals:**
- Smooth re-clustering when only a count changes (a tour added into an existing visible cluster). Centroid is allowed to tween; counts re-render via SVG replace.
- Sub-pixel-perfect cluster placement in arctic latitudes. We use a constant-`cos(lat)` approximation tuned for Switzerland (≈0.65). Acceptable error at our use case.
- Graceful behaviour at thousands of tours. Tree construction is O(n² log n).
- Server-side or persisted cluster state. Tree is purely in-memory and rebuilt per `updateTours`.
- Reintroducing a hover hull. Removed earlier; not in scope here.

## Decisions

### Hierarchical agglomerative tree (vs Supercluster, vs band-aid stabilization)

We build our own tree instead of patching Supercluster's output. Alternatives considered:

- **Keep Supercluster + suppress non-monotone transitions.** Heuristic ("don't re-cluster within 0.5 zoom of a recent split") is fragile: legitimate merges with a different cluster can happen in the suppression window.
- **Derive a tree from Supercluster** by walking zoom levels. Reintroduces the same non-monotonicity at the derivation step.
- **Greedy agglomerative on world coordinates** (chosen). Sort all tour pairs by world-meter centroid distance, repeatedly merge the closest pair into a new node, recompute the merged node's weighted centroid, repeat until one root remains. Monotone by construction. O(n² log n) build, trivial at our scale.

Each internal node carries:
- `id` (stable, assigned at build time)
- `centroid: [lng, lat]` (weighted by leaf count)
- `leafIds: string[]` (sorted, used for diff identity)
- `children: [TreeNode, TreeNode]` (always binary; root or any internal node)
- `splitZoom: number` (the zoom at which this node splits into its children)

Leaves carry `id` (tour id) and `coord`.

### `splitZoom` formula

Two centroids at metres-distance `d`, projected at zoom `z`, are at pixel distance:

```
pixelDist(z) = d * pixelsPerMeter(lat, z)
pixelsPerMeter(lat, z) = (256 * 2^z) / (40075016.686 * cos(lat * π/180))
```

The merge node's threshold zoom solves `pixelDist(z) = CLUSTER_RADIUS = 50`:

```
splitZoom = log2( (CLUSTER_RADIUS * 40075016.686 * cos(lat)) / (256 * d) )
```

For latitude we use the merge node's centroid. We do not use a constant — the cost is one `Math.cos` per merge, ~tour-count many, negligible.

### Monotonicity clamp

Centroid linkage is technically not strictly monotone in pathological inputs. Post-build pass: walk the tree top-down, and for any child where `child.splitZoom < parent.splitZoom`, set `child.splitZoom = parent.splitZoom` (degenerate but stable: the child becomes visible briefly and immediately splits further). We also propagate any change down recursively. At our scale this fires very rarely and only on near-collinear arrangements.

### Forest cut at zoom Z

```
function cutForest(root, z):
  result = []
  walk(root)
  return result

function walk(node):
  if node is a leaf: emit(node); return
  if node.splitZoom <= z:
    walk(node.children[0]); walk(node.children[1])
  else:
    emit(node)
```

Time: O(visible-nodes), which is bounded by leaf count. At our scale, the entire tree is at most a few hundred nodes, so even a full walk is microseconds.

We additionally filter the emitted forest to nodes whose centroid lies within the current map bounds (with a small padding). Out-of-view nodes still exist in the tree but are not rendered.

### Per-threshold animation during gesture (vs at-zoomstart-predicted, vs at-zoomend)

On `zoom` event we sample `currentZoom`. We maintain `lastSampledZoom`. For every tree node whose `splitZoom` is in the open interval between the two (in either direction), we fire its split or merge animation immediately. This means:

- Pure pan: no `zoom` event → no animation.
- Zoom within a `splitZoom`-free band: many `zoom` events, but no thresholds are crossed → no animation.
- Mouse-wheel zoom across one threshold: a single animation, started mid-gesture, ends shortly after `zoomend`.
- Pinch zoom across multiple thresholds: animations stagger naturally as thresholds are crossed.

Threshold lookup uses a sorted `splitZoom[]` array. Linear scan is fine at our scale; if we later care, switch to two pointers walking with `lastSampledZoom`.

### Marker-granularity tweens (vs leaf-granularity dot swarms)

When a node splits or merges, we tween at the level of the visible markers, not at the level of every constituent leaf. Concretely:

- **Split**: clone the source node's marker (pie or circle) at its centroid; tween position to first child's centroid; for each additional child, spawn a new temp marker at source centroid and tween to that child. On arrival, fade in the destination marker through `clusterCache` and remove the temp marker.
- **Merge**: for each disappearing visible node, spawn a temp marker at its centroid; tween position to the new parent's centroid; on arrival, fade in the parent marker and remove temp markers. Multiple temp markers converging look like absorption.

Temp markers for cluster nodes are constructed via the existing `createPieMarkerElement(counts, total, palette)`. Temp markers for leaves use `makeDotEl(color)`. Both reuse `animateMarker(from, to, duration, onDone)`. Duration is 250 ms with `cubicEaseOut`.

While temp markers tween for tour ids in the moving subtree, those ids are added to `animatingIds` so the GL `tours-circles` layer's filter excludes them. The cluster pie at the source position is removed at animation kickoff (not faded). The destination markers fade in at animation completion.

### Unified state-diff engine for zoom-driven and data-driven changes

The renderer maintains `lastFrame: { tree, zoom, forest, byNodeId: Map<string, RenderedNode> }`. Whenever `tree` or `zoom` changes, we recompute `forest = cutForest(tree, zoom)` and run:

```
diff(lastFrame, newForest) → { appeared, disappeared, updated }

  appeared: nodes in newForest but not in lastFrame.byNodeId
  disappeared: nodes in lastFrame.byNodeId but not in newForest
  updated: nodes in both, but centroid or leafIds differ
```

For each disappeared node, we ask: "is there an ancestor in the new tree containing all its leaves and present in the new forest?" If yes, classify as **merged into ancestor**: zoom-driven merge animation. If no, classify as **deleted**: data-driven fade-out.

For each appeared node: "was its parent or one of its descendants visible in lastFrame?" If yes, classify as **split from old parent**: zoom-driven split animation. If no, classify as **created**: data-driven fade-in (new tour).

For each updated node: tween centroid, in-place SVG re-render of pie counts.

This single engine handles every state change (zoom threshold, tour add, tour delete, tour edit, programmatic camera move).

### Cluster click → easeTo(splitZoom + ε)

```
onClusterClick(node):
  if node.splitZoom > map.getMaxZoom(): spiderfier.spiderfy(node)
  else: map.easeTo({ center: node.centroid, zoom: node.splitZoom + 0.01 })
```

The `easeTo` zoom triggers `zoom` events that cross `node.splitZoom` and fire the split animation through the standard pipeline. No special-cased click code path.

### GL source no longer clusters

`addSource` for `SOURCE_ID = 'tours'` drops `cluster: true`, `clusterMaxZoom`, `clusterRadius`. The source is a plain GeoJSON feature collection of all tours. The three GL layers (`tours-circles`, `tours-circles-selected`, `tours-completed-check`) are filtered to the set of currently-visible-as-individual tour ids — i.e. leaves of `forest` whose presence is "as themselves" rather than collapsed into a cluster pie. Filter shape:

```
['all', ['in', ['get','id'], ['literal', visibleIds]], ...selectionAndAnimExclusion]
```

This single source of truth eliminates the GL/JS divergence that produced the original sticky-cluster bug.

### Reduced motion

When `prefers-reduced-motion: reduce` is set, the diff engine commits state instantly: no temp marker tweens; appeared/disappeared markers are added/removed without fade; updated centroids snap. The diff engine and tree itself are unchanged.

### Mid-gesture data update

When `updateTours` fires while a zoom is in progress:
1. Cancel all in-flight `animateMarker` handles and remove their temp markers.
2. Rebuild the tree from the new tour list.
3. Cut the forest at current zoom.
4. Diff against `lastFrame` (which is *the previous frame's committed state*, not whatever the in-flight animations targeted).
5. Run animations as per classification.

The visual result: in-flight tween cancelled, replaced by the diff-driven correct path. No flicker because `lastFrame` is always a real, on-screen state.

## Risks / Trade-offs

- **Risk: Greedy linkage isn't globally optimal.** → Mitigation: At our scale the visual difference is imperceptible. Ward / single-linkage variants are interchangeable swaps if it ever matters.
- **Risk: `splitZoom` math edge cases at extreme latitudes / zero distance.** → Mitigation: Clamp `splitZoom <= maxMapZoom + 2` (zero distance → infinity, treated as "always merged, click → spiderfy"). Handle pairs with d=0 by setting `splitZoom = +∞` and routing clicks to spiderfy.
- **Risk: Tree rebuild during a long zoom gesture causes jarring re-cancellation.** → Mitigation: The cancel + re-diff-from-lastFrame path produces a sensible animation no matter when it fires; `lastFrame` is always coherent. We accept the small visual reset.
- **Risk: Diff classification misclassifies "merged" vs "deleted" if the user simultaneously zooms and deletes a tour at the same instant.** → Mitigation: Classification rule prefers zoom-driven if an ancestor exists in the new tree containing the disappeared leaves. If the deletion removed the last leaf, no ancestor matches → falls through to data-driven fade-out. Edge case but well-defined.
- **Trade-off: The animation engine is now stateful (`lastFrame`).** Previously it was diff-based against transient snapshots. This is unavoidable given the requirement that data-driven diffs animate from current visible state.
- **Trade-off: O(n²) tree build per `updateTours`.** At 100 tours this is ~5,000 distance computations and one heap. Microseconds. At 1,000 tours it'd be 500,000 — still well under a frame budget. The user has confirmed the upper bound is "low hundreds."

## Migration Plan

This change supersedes `cluster-rendering-anticipatory` (already archived). It is a feature-branch-internal redesign; no production rollback needed since the anticipatory work has not been deployed to main beyond PR #22 (which is the prior `cluster-overlapping-tour-markers` change). Steps:

1. Implement on the existing branch `feat/22-cluster-overlapping-tour-markers`.
2. Validate visually against the three known-bug recordings (sticky markers, re-expansion mid-zoom, animation delay).
3. Validate the new acceptance criteria for data-driven animations with a synthetic scenario (manually invoke `updateTours` from devtools).
4. Squash-merge or amend into the existing PR #22.

Rollback: revert the redesign commit; the prior `tours-marker-layer.ts` (pre-anticipatory) on main remains a working baseline.

## Open Questions

None — the grilling round resolved every branch (clustering model, build cadence, animation timing, marker granularity, click behaviour, data-update treatment, OpenSpec hygiene).
