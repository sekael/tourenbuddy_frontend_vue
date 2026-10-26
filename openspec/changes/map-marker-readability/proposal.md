# Proposal

## Why

Multi-activity tours and multi-day outings made the map harder to read. Two reviews were run
against the live app: an everyday amateur (4/10) and an IFMGA guide (3/10). Neither could plan
from the map. Their complaints:

- No marker shows which objective it is.
- A tour inside a same-spot stack can't be opened.
- A cluster tap zooms in by about 0.05 levels.
- Basemap summit symbols read as tours.
- Outings look like loose dots.
- Done, planned and undated tours look alike.

Separately, the cluster tree was rebuilt in O(n³) on every selection: 1 s at 600 tours.

## What Changes

- **Fix**: tapping a DOM marker (cluster, stack entry) no longer also reaches the map as a
  background tap. That double tap closed the sheet the marker had just opened.
- **Fix**: the selected tour stays out of clustering, so it never disappears into a pie.
- **Fix**: cluster tree build uses a nearest-neighbour cache (~O(n²), identical merges).
- Tour names on the map: from zoom 11, every individual marker gets a label with its name and
  a second line holding elevation and date (or "Erledigt" / "Ohne Datum"). Labels drop out
  where they would collide. The selected tour and focused outing segments always show theirs.
- Marker design: a white activity glyph inside every goal marker (primary activity) and a white
  ring around it. Completion, friend and link indicators move to small corner badges. Colours
  stay by activity family.
- **BREAKING (spec)**: a cluster tap fits the cluster's tours into view instead of zooming to
  `splitZoom + ε`.
- **BREAKING (spec)**: a same-spot stack opens a named list popup (activity colour, name, date,
  done) instead of the spiderfy fan.
- Outing chains: dotted links join the goals of an outing's segments, in order, also when the
  outing is not open.
- Start and end markers carry "Startpunkt" / "Endpunkt" labels while a tour is open.
- Cluster pies get a thicker ring, a larger count and a white outline.
- A map legend (activity colours and marker symbols) in the map layers panel and behind an ⓘ
  button on the map.
- Later review rounds:
  - Clusters show a completion badge.
  - Swisstopo landmark summits use the plain summit symbol, and base-map symbols under a tour
    marker give way.
  - The cluster covering a selected tour hides while it is selected.
  - Outing links are bowed arcs, not straight lines, with "Etappe n/N" in the labels.
  - The bottom controls dock at the screen edge.

## Capabilities

### New Capabilities
- `map-legend`: the legend explaining marker colours and symbols, shown in the map layers panel.

### Modified Capabilities
- `map-integration`: marker anatomy (activity glyph, ring, badges), name labels, start/end
  labels, cluster tap fit, stack list replacing spiderfy, selected tour unclustered, marker taps
  not leaking to the map, cluster pie styling.
- `tour-completion`: the completion check moves from the marker centre to a corner badge.
- `tour-outings`: outing chain line drawn outside the outing focus as well.

## Impact

- `src/features/map/presentation/components/`: `tours-marker-layer.ts`, `cluster-tree.ts`,
  `pie-marker.ts`, `spiderfy.ts` (replaced by a stack list), `tourenbuddy-map.vue`,
  `map-layers-panel.vue`, new `activity-glyphs.ts` and `map-legend.vue`.
- Locales `en.json` / `de-CH.json`: label lines, stack list, legend, start/end.
- Onboarding step copy for the map layers panel (it now holds the legend).
- No DB, Worker or API changes. Glyph PBFs for labels come from the Swisstopo font server both
  base styles already use, and are already cached for offline maps.
