## Context

Tours render today as a MapLibre GL `circle` layer backed by a GeoJSON source in `src/features/map/presentation/components/tours-marker-layer.ts`. Each tour is one Point feature with `tourType` and `completed` properties. A second circle layer renders the selected tour, and a `symbol` layer overlays a check icon for completed tours. There is no clustering — multiple tours at the same goal coordinates (or near each other at low zoom) render on top of one another, hiding count and type information.

Issue #22 asks us to detect this collision at the current zoom level and replace overlapping markers with a single, type-aware aggregate. MapLibre supports clustering natively on GeoJSON sources via `cluster: true` and `clusterRadius` (pixel-based, recomputed automatically per zoom). Clustering also exposes `clusterProperties` for expression-based aggregations and `getClusterExpansionZoom` / `getClusterLeaves` for interaction.

## Goals / Non-Goals

**Goals:**

- Aggregate visually overlapping tour markers at any zoom into a single cluster marker.
- Convey type composition of the cluster as a pie chart with one slice per tour type.
- Show total cluster count as a centered numeric label.
- Re-evaluate cluster membership automatically as the user zooms in or out.
- Preserve all existing single-marker behavior (color, completed glyph, selected state, click-to-select, edit-mode preview).
- Keep ESLint, type-check, and unit tests green.

**Non-Goals:**

- Spider / fan-out interaction at maximum zoom for points sharing identical coordinates (out of scope; click expansion suffices for now — accept that two tours at the exact same lng/lat remain a permanent cluster until the user uses the tour list).
- Clustering applied to GPX track layers (only goal-point markers).
- Animations between cluster and individual states beyond MapLibre's default zoom animation.
- Custom collision heuristics (rely on MapLibre's pixel `clusterRadius`).

## Decisions

### Use MapLibre's built-in GeoJSON clustering

`cluster: true` with `clusterRadius` computed from the marker visual radius (~14 px circle radius + small breathing room → cluster radius around 32 px). This keeps clustering on the GPU side, recomputed by MapLibre on every zoom change, and avoids reinventing collision detection.

**Alternative considered:** custom JS-side overlap detection in a Pinia store. Rejected — duplicates work MapLibre already does, won't recompute reactively on zoom without manual `moveend` listeners, and would force us to manage two parallel marker representations.

### Aggregate per-type counts via `clusterProperties`

Add one entry per `TourType` to `clusterProperties`:

```ts
clusterProperties: {
  ski: ['+', ['case', ['==', ['get', 'tourType'], 'ski'], 1, 0]],
  // ... one per TourType, plus an `unknown` bucket for null
}
```

These counts come back on each cluster feature returned by `querySourceFeatures` and are everything the pie renderer needs.

**Alternative considered:** call `getClusterLeaves` per cluster on every render to recompute counts. Rejected — additional async calls per visible cluster, and `clusterProperties` already provides exactly the aggregation we need.

### Render clusters as DOM HTML markers (SVG pie + count label)

MapLibre `circle` and `symbol` paint layers can't draw pie slices. The standard pattern (used in the official Mapbox/MapLibre cluster-html example) is:

1. Filter the existing single-tour layers with `['!', ['has', 'point_count']]` so cluster features render via DOM, not via the circle layer.
2. On `data` and `moveend` events, call `map.querySourceFeatures('tours', { filter: ['has', 'point_count'] })`.
3. Diff the result against a `Map<clusterId, maplibregl.Marker>` cache: create new ones, update existing ones in place, remove gone-ones.
4. Each marker's element is a small SVG (~36 px) generated from the per-type counts: `<path>` per slice using polar-to-cartesian + arc flag, plus a centered `<text>`.

**Alternative considered:** pre-render every possible type-combo as a sprite via `addImage` and use a `symbol` layer. Rejected — combinatorial explosion (every multiset of types × ratio bucket), and the SVG approach is straightforward and reactive.

**Performance note:** in normal use the visible cluster count is small (tens, not thousands). DOM marker overhead is negligible. If profiling later shows it matters, the sprite approach is a viable upgrade path without changing the spec.

### Animated split / merge transitions

MapLibre clustering swaps features in and out instantly on `zoomend` — there is no built-in transition. To make split/merge feel smooth we add a thin animation layer that owns *temporary* DOM markers during the transition, then hands rendering back to the GL circle layer.

**Snapshot before zoom.** On `zoomstart` (and on every `move`/`moveend` so the snapshot stays fresh), record:

- `prevClusters: Map<clusterId, { lngLat, leafTourIds: string[] }>` — derived from `querySourceFeatures({ filter: ['has','point_count'] })` plus `source.getClusterLeaves(clusterId, Infinity, 0)` (cached per cluster).
- `prevLeafCoords: Map<tourId, lngLat>` — derived from the GeoJSON tours data already in the store; `lngLat` is just the tour's goal coordinates and is stable, so this map is essentially the tours store keyed by id.

**Detect transitions on `zoomend`.** Re-query clusters and individual features:

- *Split*: any tour id that is now an individual feature AND was a leaf of a cluster present in `prevClusters` is a split-leaf. Its animation start = the previous cluster's last screen position; end = its true coords.
- *Merge*: any cluster present now whose leaf set contains tour ids that were individuals previously is a merge target. Each such leaf animates from its previous coords toward the new cluster centroid.

**Run animation.** For each animating leaf:

1. Add tour id to an `animatingIds: Set<string>` and update the `tours-circles` / `tours-circles-selected` / `tours-completed-check` filters to additionally exclude `['in', ['get','id'], ['literal', [...animatingIds]]]`. Cluster pie markers for *merge* targets are also withheld until their animation completes — track these in `pendingClusterIds: Set<number>` and skip their DOM creation in the diff loop.
2. Create a temporary DOM marker (a small colored circle matching the tour's type — same SVG used for the pie slice color) positioned at the start point.
3. Animate via `requestAnimationFrame` over 300 ms with ease-out (cubic). Each frame updates `marker.setLngLat(interp)`.
4. On completion: remove the temp marker, delete id from `animatingIds`, refresh layer filters; for merges, delete from `pendingClusterIds` so the pie marker appears.

**Interruption.** If a new `zoomstart` fires while animations are running, cancel all rAF handles, remove all temp markers, clear both sets, and re-evaluate from scratch — this is the cleanest way to avoid orphan DOM nodes when the user zooms repeatedly.

**Reduced motion.** Wrap the whole machinery behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches`; when true, skip animation entirely (no temp markers, no filter exclusions, no pending clusters).

**Why DOM-marker animation, not GL.** The MapLibre circle layer's `circle-translate` paint property animates in screen pixels and applies to *all* features in the layer — it can't drive per-feature interpolation. Per-feature animation requires either swapping the source GeoJSON every frame (expensive, triggers cluster recompute) or external markers. DOM markers for the brief transition window are the path of least resistance and reuse the existing pie/leaf SVG primitives.

**Alternative considered:** drive a per-feature `progress` property and a custom `circle-translate-anchor` expression. Rejected — `circle-translate` is uniform per layer; would require N layers (one per animating leaf) which churns the style on every zoom.

### Cluster click → `getClusterExpansionZoom`

Wire `click` on the cluster marker element to `source.getClusterExpansionZoom(clusterId)` then `map.easeTo({ center, zoom })`. This is MapLibre's documented pattern.

### i18n

Add `map.cluster.label` (e.g. `"Cluster of {count} tours"` / `"Cluster aus {count} Touren"`) to `en.json` and `de-CH.json`. Used as the marker element's `aria-label`.

### Lifecycle

`useToursMarkerLayer.setup()` already runs on map load and after `styledata` reloads. The cluster-marker DOM cache must be cleared and rebuilt on style reload (style swap removes our source). A `cleanup()` exit hook will iterate the cache, call `marker.remove()`, and clear it; this runs on map `remove()` and before each style reload.

## Risks / Trade-offs

- **DOM marker count at extreme zoom-out** → at the global zoom every tour could be in one cluster — fine; only one DOM node. The opposite (no clusters at all) means zero DOM markers — also fine. The middle ground (many small clusters) is bounded by viewport area / cluster radius.
- **`clusterProperties` works only on the source root** → all type aggregations live on the source. Adding a new tour type means updating both `TOUR_TYPE_COLORS` and the cluster properties map. Mitigation: derive the `clusterProperties` object programmatically from the `TourType` enum so they cannot drift.
- **Selected-state interaction** → if the selected tour is hidden inside a cluster, the existing selected-circle layer renders nothing for it. Mitigation (initial scope): the existing `flyTo` already brings the camera close enough to break the cluster; acceptable. If tests show selection feels lost, a follow-up can render a small selected-state ring on the parent cluster marker.
- **Edit-mode preview** uses a separate `tours-preview` source and is unaffected — keep it non-clustered.
- **Animation orphans on rapid zoom** → mitigated by cancelling all in-flight rAF handles + clearing temp markers on `zoomstart`. Unit-test the cancellation path explicitly.
- **Snapshot accuracy for the split source point** → at `zoomend` the previous cluster's GL feature is already gone, so we must capture cluster screen positions on `zoomstart` (or read the last `prevClusters` snapshot). If a cluster moved between two `moveend`s without a zoom (panning), our snapshot still holds because cluster centroids in `lngLat` are stable for a given zoom.
- **Style reload races** → cluster DOM markers must be removed before `setStyle` is called. The map currently re-runs `setup` on `styledata`; we'll hook the same path to drop stale markers.
- **Identical-coordinate tours** stay clustered even at max zoom (no expansion zoom exists). Accepted limitation; spider behavior is non-goal.

## Migration Plan

No data migration. The change is rendering-only and ships in a single PR. Rollback = revert the PR.

## Open Questions

- Should the centered count label use white text with a dark stroke, or a small white disc behind the number? Defer to design review during implementation; either satisfies the spec.
- Cluster marker diameter: keep equal to single-marker diameter (28 px) or scale slightly with count? Start with a fixed diameter slightly larger than a single marker (~36 px) so users distinguish cluster from single at a glance; revisit if feedback warrants a count-scaled radius.
