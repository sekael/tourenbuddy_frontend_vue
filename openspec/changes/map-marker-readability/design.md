# Design

## Context

Goal markers are GL layers on the `tours` source: circle, split-fill symbol, and full-size
friend / link / check glyphs. Clusters and spiderfy legs are DOM `maplibregl.Marker`s driven by a
hand-built hierarchical cluster tree (`cluster-tree.ts`) and a forest diff
(`cluster-transitions.ts`). Both base styles (`basemap.vt` vector, WMTS raster JSON) declare the
same Swisstopo `glyphs` URL. The offline map already caches the Frutiger Neue stacks for code
points 0–1023. See proposal.md for the review findings this answers.

## Goals / Non-Goals

**Goals:** every finding from both round-1 reviews except those listed below; no regression in
cluster stability, transitions or offline rendering.

**Non-Goals:**
- Changing the activity colour families (the activity glyph separates activities instead).
- Moving the "Meine Touren" pill or the inbox badge.
- Changing how an outing or tour is framed on open.
- Status counts inside cluster pies (cluster labels already appear from z11 when zoomed in).

## Decisions

**D1 — Stop marker clicks at the element.** A click on a DOM marker bubbles to the map's
canvas container, so MapLibre also fires a map `click`. With no GL feature under the point,
`tourenbuddy-map` treated it as a background tap and closed the sheet the marker had just
opened. That is the "fan entries are dead ends" bug. Cluster and stack-list handlers call
`stopPropagation()`.
*Alternative:* filter `.maplibregl-marker` targets inside the map click handler. Rejected: it
spreads the knowledge to every map click consumer.

**D2 — Content-hashed cluster ids + the selected tour is pinned.** The selected tour is excluded
from the tree like a focused outing's segments, so it always renders individually. Rebuilding
on selection must not churn unrelated clusters. Cluster ids therefore derive from their leaf
set (a count plus an order-independent sum of 32-bit leaf hashes) instead of merge order. Only
the selected tour's ancestors change identity.
*Alternative:* keep the tree and draw the selected leaf on top. Rejected: the cluster count
would still include it and the pie would sit under it.

**D3 — Nearest-neighbour cache in the tree build.** A merge invalidates only the nodes whose
nearest neighbour was one of the merged pair. The result is ~O(n²), with the same merge set as
the exhaustive search (test checks equivalence against the old algorithm).

**D4 — Name labels as a GL symbol layer.** Two layers on the `tours` source:
- `tours-labels`: individual visible tours, minzoom 10.
- `tours-labels-focus`: selected tour and pinned segments, no minzoom.

Both are filtered like the circles. The text is `format`ted: name in Frutiger Neue Medium
13 px, then a 11 px Regular line from a `labelSub` property. That line holds elevation · date
(range), or "Erledigt" / "Ohne Datum"; an outing segment's line starts with its stage
("Etappe 2/3"). The marker layer receives a `describeTour(tour)` callback
from `tourenbuddy-map.vue`, which owns i18n and formatting. Labels use variable anchors
(right, left, below, above) at a radial offset outside the circle, white halo, and take part in
collision. They therefore displace colliding basemap labels: the objective's own label replaces
the summit label it usually sits on. Code points 8192–8447 (en dash, thin spaces from
`formatRange`) join the offline glyph ranges.
*Alternative:* DOM labels. Rejected: no collision handling, heavy with hundreds of tours.

**D5 — Marker anatomy.**
- **Centre glyph**: the white glyph of the primary activity. It is rendered from the shared icon
  registry (`iconRegistry[TOUR_TYPE_ICONS[type]]`, the same glyphs as the list and sheet) into
  a detached element with Vue's `render`, recoloured white and rasterised once at setup at 4×
  pixel ratio. Untyped tours get no glyph.
  *Alternative:* `~icons/…?raw` imports. Rejected: they duplicate the registry, and their
  module typing collides with the Vue component declaration of `~icons/*`.
- **Ring**: a white 1.5 px ring on every goal circle, so markers read as app pins, not basemap
  symbols (the reviewers mistook Swisstopo summit pictograms for tours).
- **Footprint**: the glyph symbol (a blank image for untyped tours) takes part in symbol
  placement with a padding that covers the circle, so base-map symbols under a marker (the
  Swisstopo summit pictogram both reviewers took for a second marker) are not drawn.
- **Badges**, 17 px discs:
  - Completed: green with a white check, bottom-right.
  - Friend or link: white with a dark glyph, bottom-left. Link wins, as today.
  - Segment number: stays top-right.
- One generic `loadSvgImage` replaces the four near-identical icon loaders.

**D6 — Cluster tap fits the leaves.** Target zoom is the larger of `splitZoom + ε` and the zoom
from `cameraForBounds(leaf bounds, padding 64 / 112 at the bottom for the tour bar)` capped at
15.5 (round 2: tours metres apart sent the map to z18), and at least one level above the
current zoom (round 4: a country-wide cluster's fit moved z7.6 → z8.3, four taps to a stack). It is capped at the max zoom and centred
on the fitted camera. A cluster whose `splitZoom` exceeds `STACK_ZOOM = 17` (tours metres apart)
is a stack, and a tap opens the stack list. Beyond z17 the basemap is over-zoomed and still
wouldn't separate them usefully.

**D7 — Stack list replaces spiderfy.** A `maplibregl.Popup` at the stack's centroid shows a
title ("11 Touren an diesem Ort") and one button per tour: a colour dot (split like the marker,
✓ when done), the name, and the `labelSub` line. Rows are ordered dated-planned (ascending),
then undated, then done. A tap selects the tour. Escape closes and returns focus to the cluster
marker; focus moves to the first row on open. Opening pans the stack to the upper middle (no
zoom), so the list (up to 55 vh) opens below it on screen; CSS scroll shadows mark hidden rows.
Each row's dot carries the activity glyph, as on the marker. `spiderfy.ts` and its tests are deleted.
*Alternative:* bigger spiderfy dots with labels. Rejected: 11 names around one point overlap
and cover the terrain the user is looking at.

**D8 — Outing chain line.** Each link is a bowed quadratic arc (control point pushed sideways by
a fifth of the distance) — round 2 showed straight lines read as the route across glaciers and
lakes. A `tours-outing-chains` line source/layer below the goal circles,
round dark-slate dots (4 px, 75 % opacity). Dots rather than dashes, because dashed dark lines
are footpaths on a Swisstopo map. It holds one LineString per owned outing with ≥ 2
segments on the map, through the segment goals in order. The focused outing is excluded: its
GPX tracks and connectors already show the route. `outingChains()` in the outing domain module
builds the lines from `mapTours` with the existing `outingKey` / `outingSegments` helpers.

**D9 — Start/end labels.** The detail source carries a `label` ("Startpunkt" / "Endpunkt",
existing keys). A small text layer draws it below the detail circle; handover rings get none.

**D10 — Cluster pie.** Same 36 px marker: inner disc r 10 → 8, count 12 px semibold (10 px from
three digits), white 2 px outer ring, CSS drop shadow.

**D12 — Selection over its stack.** After every frame commit, a cluster whose centroid is within
24 px of the selected tour is hidden (`visibility: hidden`) until the selection changes. Round 2
offset it instead, but the framing zoom merged nearby tours into it ("11" in the list became
"13" on the map), which read as a broken count. Round 4 (guide) wanted the others still
counted: a "+N" chip DOM marker at the selection's upper left counts tours within 25 m (the
same-spot set, so it agrees with the list: 11 listed → "+10"), and opens their stack list
upward (`anchor: 'bottom'`, the stack panned to mid-height) above the open sheet.

**D13 — Landmark summits.** The vector base style draws landmark peaks (`peak_lm`) as navy
pictogram discs, which both reviewers repeatedly took for tours. On every style load the layer's
`icon-image` becomes the base map's own `mountain` symbol at the regular peak size; labels are
untouched. The raster style has no such layer (no-op).

**D14 — Status on clusters and the bottom band.** A cluster's DOM marker carries a green badge
(✓, or ✓ + n) for its completed members, updated only when that count changes and hidden via
`display` at zero (the `hidden` attribute loses to its inline `display:flex`). Planned / undated
counts go into the cluster's `aria-label` + `title` (hover on desktop, where seasons are
planned) rather than more badges on a 36 px pie. The tour bar and
the menu/legend column dock at `spacing-lg + safe-bottom`, level with the location picker: at
`spacing-3xl` they floated over a live band of map where objectives could not be tapped.

**D11 — Legend.** `map-legend.vue` sits in the layers panel below the overlays. Colour rows are
derived by grouping `TOUR_TYPE_COLORS` by colour, labelled with the activity names, so a palette
change updates the legend. The rows are:
- multi-activity (split dot)
- no activity (grey)
- done badge
- friend badge
- linked badge
- cluster
- outing chain

The panel scrolls when taller than the viewport. A 40 px ⓘ button opens the same legend alone (a fourth
speed-dial `view`), one tap from the map. It sits bottom left in the tour bar's row, a band the
controls already occupy; above the menu button it hid map labels (round 4).

## Risks / Trade-offs

- [Labels hide basemap labels next to objectives] → intended (D4); labels only show from z11
  and drop out under collision, and the tour's own label carries name + elevation.
- [Selection now rebuilds the tree] → D3 makes it ~20 ms at 300 tours; D2 keeps unrelated
  clusters still.
- [Offline glyph ranges grow] → 5 extra small PBFs per region download.

## Migration Plan

Frontend-only; ships with the next release. Rollback = revert the PR.
