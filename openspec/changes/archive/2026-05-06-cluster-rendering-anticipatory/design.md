## Context

`cluster-overlapping-tour-markers` introduced GeoJSON source clustering plus DOM pie-marker rendering driven from `map.querySourceFeatures(SOURCE_ID, { filter: ['has', 'point_count'] })` and `(source as GeoJSONSource).getClusterLeaves(...)`. Manual verification surfaced four defects that all share a single architectural root cause: cluster authority lives inside the MapLibre tile pipeline.

Concretely:

- `querySourceFeatures` returns *currently rendered* features. Its return value depends on which tiles have parsed and uploaded to the GPU at the moment of the call, not on the underlying source data. During and immediately after a zoom, partial tile state means partial cluster state — the same cluster can be present, missing, or duplicated by an adjacent stale tile for tens to a few hundred milliseconds.
- `getClusterLeaves` is asynchronous, callback-based, and only resolves once the tile that owns the cluster ID is parsed. Snapshots taken on `zoomstart` therefore cannot include `leafIds` synchronously, which is why the existing `snapshotClusters` returns `leafIds: []`. `diffSnapshots` consumes those empty arrays and silently produces zero splits.
- The GL `circle` layer's filter (`['!', ['has', 'point_count']]`) re-evaluates the moment a tile lands; it can hide an individual marker before the corresponding cluster DOM marker has been (re)created in the next sync pass. The reverse — cluster vanishing before individuals appear — has the same shape on zoom-in.
- DOM cluster markers and GL circle features for the same tour can co-exist on screen when one tile reports the tour as a leaf of a cluster while a neighbouring stale tile still renders the same tour as an individual point.

Patching each symptom (extra `idle` listeners, defensive `setTimeout`s, reading source data twice) keeps the authority in the wrong place. The fix is to move cluster computation into a JS-side index whose state is synchronous, deterministic, and independent of tile load. MapLibre already uses `supercluster` internally for source clustering; running an additional instance in our code is well-trodden ground (the official "create a custom HTMLElement marker" example pre-dates `cluster: true` and uses exactly this approach).

## Goals / Non-Goals

**Goals:**

- Eliminate the four defects listed in the proposal.
- Make cluster DOM rendering a pure function of `(tours, zoom, bbox)` — synchronous and deterministic.
- Pre-create destination DOM markers before the GL repaint lands on a zoom transition, so the user never sees an empty intermediate state.
- Bridge any residual visual gap with a short opacity fade on both the GL circle layer and the cluster DOM markers.
- Keep all behaviour added in `cluster-overlapping-tour-markers` — pie aggregation, click-to-expand, ARIA, completed-check, selection, edit-mode preview — intact.
- Keep ESLint, type-check, and unit tests green.

**Non-Goals:**

- Removing MapLibre's source-side `cluster: true`. We continue using it so the GL circle layer's `['!', ['has', 'point_count']]` filter still hides clustered points; we just stop reading from the rendered tiles.
- Spider/fan-out at max zoom for identical-coordinate tours (still out of scope from prior change).
- Animating the cluster→cluster transition where two clusters merge into one (animate-leaves-only is sufficient, matching prior scope).
- Replacing the GL circle layer with DOM markers entirely. That would simplify state but lose GPU rendering performance for the common dense-individual-points case.

## Decisions

### Add a JS-side `supercluster` instance as the authoritative cluster index

Install `supercluster` as a direct dependency. Build one instance in `useToursMarkerLayer`, configured to mirror the source's clustering exactly:

```ts
import Supercluster from 'supercluster'

const index = new Supercluster({
  radius: CLUSTER_RADIUS,           // same const used in addSource
  maxZoom: CLUSTER_MAX_ZOOM,        // same const
  minPoints: 2,                     // MapLibre default
}).load(toursToGeoJson(tours).features)
```

Querying is synchronous:

```ts
const z = Math.floor(map.getZoom())
const [west, south, east, north] = map.getBounds().toArray().flat()
const features = index.getClusters([west, south, east, north], z)
// each feature: cluster (has cluster_id, point_count, properties) or individual leaf
```

Per-cluster leaf IDs are also synchronous:

```ts
const leafFeatures = index.getLeaves(clusterId, Infinity, 0)
const leafIds = leafFeatures.map(f => f.properties!.id as string)
```

`clusterProperties` aggregations from the GeoJSON source do not transfer to a hand-rolled supercluster index, so we recompute per-type counts ourselves by iterating leaves of each visible cluster (small N — leaves of a single visible cluster are bounded by total visible tours). This trades a tiny re-iteration for a fully synchronous, leakproof source of truth and removes the `clusterProperties` expression set entirely from the GL source — one less duplicated config surface.

**Alternative considered:** keep using `querySourceFeatures` but defer all cluster operations to `idle`. Rejected — `idle` fires once tiles settle, but only *after* the user has already seen the missing-marker frame. Doesn't fix defects 1–3; only partially mitigates 4.

**Alternative considered:** keep `cluster: true` and read from the underlying `_clusterIndex` private field. Rejected — relies on MapLibre internals that are not part of the public API and have changed across versions.

### Keep MapLibre source clustering enabled for the GL filter pathway

Removing `cluster: true` from the source would force every tour to render as an individual circle and we'd have to add per-marker DOM management for non-clustered tours too. Keep `cluster: true` so the existing `circle` / `circle-selected` / `completed-check` layer filters (`['!', ['has', 'point_count']]`) keep doing their job. The JS index is purely additive: it owns the *cluster pie* DOM rendering and animation snapshots; the GL source still owns the *individual circle* rendering.

This means the JS index and the GL source must be configured identically (same `clusterRadius`, same `clusterMaxZoom`, same `minPoints`). To prevent drift, define both from a single shared constants module within the file (or a sibling `cluster-config.ts`). Tests assert that the values used to construct the GL source match the values used to build the supercluster instance.

### Snapshot rewrite: synchronous, leaf-aware

`cluster-transitions.ts` is reduced to a pure function over the JS index plus current zoom/bbox:

```ts
export function snapshotClusters(
  index: Supercluster,
  bbox: [number, number, number, number],
  zoom: number,
): ClusterSnapshot {
  const features = index.getClusters(bbox, Math.floor(zoom))
  const snapshot: ClusterSnapshot = new Map()
  for (const f of features) {
    if (f.properties.cluster) {
      const clusterId = f.properties.cluster_id as number
      const lngLat = f.geometry.coordinates as [number, number]
      const leafIds = index
        .getLeaves(clusterId, Infinity, 0)
        .map(l => l.properties!.id as string)
      snapshot.set(clusterId, { lngLat, leafIds })
    }
  }
  return snapshot
}
```

`leafIds` is now always populated. `diffSnapshots` keeps its current signature; the existing tests pass with the new snapshot shape.

`snapshotClustersAsync` is removed. Anything that called it now calls `snapshotClusters`.

### Anticipatory rendering on `zoomstart`

The GL repaint after a zoom can land before our DOM markers exist. Bridge it by pre-creating the destination DOM markers up front:

1. On `zoomstart`, read `map.transform.zoom` and the camera's eased target zoom from the active zoom event (`event.target.transform._zoomTarget` is internal — we use the post-`zoomend` zoom directly via a deferred `requestAnimationFrame` after `zoomend` instead, but keep the *destination snapshot* pre-staged on `zoomstart` using `Math.round(map.getZoom() + Math.sign(zoomDelta))` as a best-effort target).
2. For each cluster in the predicted target snapshot that does not yet have a DOM marker, create the marker with `opacity: 0` and append at its target lngLat.
3. On `zoomend`, take the authoritative snapshot at the now-final zoom, reconcile against the cache (some predicted markers will be discarded; the rest fade in to opacity 1; departing ones fade out and are removed on `transitionend`).

The prediction does not need to be perfect. Even when wrong, the fall-back is "DOM marker created on `zoomend` with opacity 0 → fade in" — i.e. the same path with one extra frame of latency. The opacity-bridge transition (next decision) absorbs the gap cleanly.

**Alternative considered:** subscribe to `zoom` (continuous) and re-snapshot every event. Rejected — `zoom` fires per frame during eased camera moves; computing leafIds for every cluster every frame is wasteful and would force throttling. The two-event split (`zoomstart` predict, `zoomend` reconcile) gives natural rate limiting.

### Opacity bridge

Two CSS / paint changes:

- Cluster DOM marker root element: `transition: opacity 200ms ease`. New markers append with `opacity: 0`, then a `requestAnimationFrame(() => el.style.opacity = '1')` triggers the transition. Departing markers set `opacity = '0'` and `removeOn` `transitionend`.
- GL circle layers (`tours-circles`, `tours-circles-selected`, `tours-completed-check`): add `'circle-opacity-transition': { duration: 200 }` (and `'icon-opacity-transition'` for the symbol layer). MapLibre interpolates the layer paint property between values when the filter flips.

The combined effect: on zoom-in (cluster→individuals), pies fade out as circles fade in; on zoom-out (individuals→cluster), the reverse. Even if a tile is briefly stale, both states are at partial opacity rather than fully opaque, so the visual is "cross-fade" rather than "double-render."

**Alternative considered:** snap, no transition. Rejected — even with a perfect JS index, the tile-state mismatch on the GL layer is real; without a fade, double-render flashes will still occur on slow devices.

### Idle reconciliation

Add `map.on('idle', () => syncFromIndex())` as a final safety net. `idle` fires once after all tiles have rendered and no animation is in flight. If anything is out of sync (rare but possible — cluster ID reuse, supercluster vs MapLibre numerical drift on edge cases) this corrects it without the user seeing it.

### Cluster radius retune (32 → 50 px)

The Flutter sibling app for similar tour-on-map UX uses `maxClusterRadius=80`. Empirically 32 px in MapLibre felt aggressive enough that single tours kept clustering and de-clustering on minor pan-induced screen-space shifts. Move to **50 px**: comfortable margin between distinct visible markers, fewer rapid cluster-membership flips during pan, still tight enough that a deliberate zoom-in cleanly splits clusters within one or two zoom steps.

The same constant feeds both the GL source `clusterRadius` and the JS-index `radius` (single source of truth, see "Add a JS-side `supercluster` instance" decision).

### Spiderfy for un-expandable clusters

Two scenarios that the prior change explicitly accepted as limitations are now solvable cheaply:

1. **Identical-coordinate tours** — two tours pinned to the same lng/lat will share a cluster at every zoom. `getClusterExpansionZoom` returns the source `maxZoom`; clicking does nothing useful past that point.
2. **Cluster at the configured `clusterMaxZoom`** — the cluster won't expand even though leaves are not strictly co-located.

Spiderfy fans the leaves out around the cluster centroid in screen space so each is individually clickable, with thin connector lines back to the centroid for visual grouping.

**Trigger.** When the user activates a cluster (click / Enter / Space), call `getClusterExpansionZoom(clusterId)`. If `expansionZoom <= currentZoom`, spiderfy instead of zooming. Otherwise, fall through to the existing `easeTo` behavior.

**Layout.**

- `n ≤ 8`: circle layout. Place leaves on a circle of radius 32 px (≈ marker radius + half marker size) around the centroid; angle step = `2π / n`, start at `-π/2` (12 o'clock).
- `n > 8`: Archimedean spiral. `r(θ) = a + b·θ`, with `a = 28`, `b = 5`; angle step = `2π / 6` (six leaves per turn), continuing outward.

These match `leaflet.markercluster`'s defaults closely; the math is ~20 lines.

**Connector lines.** A dedicated MapLibre `line` layer (source `cluster-spiderfy-lines`) draws short segments from each spiderfied leaf back to the centroid. Updated each time the spiderfy set changes; cleared on despiderfy.

**Leaf rendering.** Each spiderfied leaf is rendered as a DOM marker (same SVG primitives as the per-type leaf used in transitions). Click on the leaf invokes `onTourClick(tourId)` — same callback as the GL circle layer click handler.

**Despiderfy triggers.**

- Map `move` / `zoom` (any camera change): collapse, return rendering to the pie cluster.
- `Escape` keypress while any leaf has focus.
- Clicking a different cluster.
- The `cleanup()` exit hook (style reload, unmount).

**During spiderfy, the underlying pie cluster marker** stays visible at the centroid (so the user keeps the count + composition cue); leaves are rendered *in addition*. Visual order: pie at centroid, connector lines below leaves, leaves on top.

**Alternative considered:** zoom to `maxZoom + 1` and let the GL layer split. Rejected — for identical coordinates this never splits no matter how far we zoom; for `clusterMaxZoom` it forces a viewport jump and loses the user's spatial context.

### Coverage hull on hover/focus

Hovering or keyboard-focusing a cluster marker briefly visualizes the geographic extent of the cluster's leaves. Useful for "what's in here?" without committing to an expansion zoom or spiderfy.

**Computation.** Andrew's monotone-chain convex hull, ~30 lines, run synchronously over `index.getLeaves(clusterId)` coordinates. Result is a closed polygon ring in lng/lat.

**Rendering.** A dedicated MapLibre `fill` layer + `line` layer backed by a single GeoJSON source `cluster-hull`. On `pointerenter` / `focus` of a cluster DOM element: compute the hull, set the source data to a single Polygon feature. On `pointerleave` / `blur`: set the source data to an empty `FeatureCollection`.

**Style.** Light theme blue accent border (matching the design tokens — slate primary, blue accent), low-opacity fill (~10%). Roughly:

```ts
{ 'fill-color': 'var(--color-accent)', 'fill-opacity': 0.1 }
{ 'line-color': 'var(--color-accent)', 'line-width': 2 }
```

(MapLibre paint properties don't read CSS custom properties; the actual values are pulled from a single `MAP_HULL_STYLE` constant aligned with `tokens.css`.)

**Edge cases.**

- Single leaf (degenerate): no hull rendered (cluster of 1 doesn't visually exist).
- Two leaves: render as a thin line segment, no fill.
- All-collinear leaves: degenerate polygon — clip to a thin line. The hull algorithm handles this naturally.
- Touch devices have no `pointerenter` — gate via `(hover: hover)` media query so hull only activates on hover-capable devices. Touch users get spiderfy instead.

**Accessibility.** Hull visibility on keyboard focus is informational, not interactive — no ARIA changes needed.

### Animation pipeline reuses existing `animateMarker`

The `animateMarker` rAF + cubic-ease-out helper from `cluster-overlapping-tour-markers` stays. The only change: `runTransitions` now consumes a `prevSnapshot` produced by the JS index (already has `leafIds`), so split detection works on first zoom. Reduced-motion gate, temp-marker creation, and `cleanup()` paths are unchanged.

### Removing `clusterProperties` from the source

Once the JS index is the source of truth for pie counts, the `clusterProperties` aggregation on the GL source is dead code — it's still computed by MapLibre, just never read. We remove it to keep the source config minimal. The `buildClusterProperties` export stays (for now) only if external test code depends on it; otherwise it goes too. Tests covering `buildClusterProperties` are removed in lock-step.

## Risks / Trade-offs

- **Config drift between GL source and JS index** → Mitigation: single `CLUSTER_RADIUS` / `CLUSTER_MAX_ZOOM` / `CLUSTER_MIN_POINTS` constants used for both; test asserts both consumers see the same values.
- **`supercluster` vs MapLibre numerical clustering differences at edge cases** → Mitigation: clusters in our DOM and individual circles in the GL layer use the same filter (`has point_count` from MapLibre's perspective vs `cluster=true` from supercluster's). Mismatch could cause a tour to be rendered as both a leaf in our pie AND as an individual circle. The opacity bridge masks this visually; the `idle` reconciliation closes the loop. Worst-case briefly-double-rendered tour for tens of milliseconds — strictly better than today's hundreds of milliseconds.
- **Bundle size** → `supercluster` is ~12 KB minified. Acceptable; documented in proposal.
- **Memory** → one extra index per map instance, holding all tour points. With realistic tour counts (tens to low thousands) this is negligible.
- **Anticipatory prediction wrong-direction** → If the user zooms the opposite of what we predict (e.g. begins to zoom-in then reverses), we may pre-create markers we then discard. They were at opacity 0 the whole time — invisible — and are removed on the reconciliation pass. No user-visible artifact.
- **`zoomstart` fires for non-zoom camera moves** in some MapLibre versions → guard with `event.originalEvent` / `map.isZooming()` checks; if `map.getZoom()` doesn't change between `zoomstart` and `zoomend`, no-op the transition logic.
- **Style reload races** still apply — `cleanup()` already handles them; nothing new to add.
- **Spiderfy + animation interaction**: if a zoom transition starts while a cluster is spiderfied, leaf positions drift relative to the centroid. Mitigation: despiderfy on `movestart` / `zoomstart`. A spiderfied state is by definition transient; collapsing on any camera move is the expected leaflet.markercluster behavior.
- **Hull layer z-order**: the hull fill must sit below cluster markers but above tile labels. MapLibre layer order is insertion-order; we add the hull layers right after the GL circle layers and before the marker-cluster DOM (DOM markers always render above any GL layer, so DOM ordering is automatic).
- **Hull on rapidly-moving hover**: pointer crossing many clusters in quick succession could thrash the source data update. Mitigation: debounce hull updates by ~30 ms (one or two frames) — invisible to the user, prevents redundant GeoJSON serialization.

## Migration Plan

No data migration. Single-PR change on the same branch as `cluster-overlapping-tour-markers`. Rollback = revert the follow-up commit; the original cluster implementation remains usable (with its known defects) underneath. No feature flag — the change is small enough and the prior version is broken enough that a flag would slow ship without buying optionality.

## Open Questions

- **Should the JS index be exposed as a Pinia store** so other components (e.g. the tour list) can ask "is tour X currently in a cluster?" — Defer. The current marker layer scope is sufficient. If a future feature needs that query, lifting the index to a store is a one-file refactor.
- **Should `circle-opacity-transition` duration match the DOM `transition: opacity` duration exactly, or be slightly shorter on the layer to bias toward "cluster appears first, individuals fade after"?** — Start at 200 ms equal both sides; revisit during manual verification if the cross-fade looks off.
- **Should anticipatory predict use `map.transform._zoomTarget` (private)** instead of sign-of-zoomDelta heuristic? — No. The heuristic plus reconciliation is robust and uses only public API.
- **Spiderfy circle vs. spiral threshold** — Flutter sibling uses 12 leaves as the switchover. Our cluster sizes are typically smaller (Swiss tour density), so 8 might be the sweet spot. Validate during manual verification; tune with a single constant.
- **Should the coverage hull also render during a sustained long-press on touch?** Defer. Spiderfy already covers the touch-equivalent of "show me what's in here" — adding a hold-to-preview gesture without a clear user request risks gesture conflict with map pan.
