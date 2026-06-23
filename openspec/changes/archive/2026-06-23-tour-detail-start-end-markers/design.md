## Context

Goal markers are rendered as a clustered MapLibre **GL circle layer** backed by the `tours` GeoJSON source (`tours-marker-layer.ts`), with sibling SDF symbol layers (`check`, `friend`, `link`) tinted on top. Clustering, collision suppression, and the default map view all operate on this goal-only source. A second `tours-preview` source renders a single lighter-tone **draft goal** marker during create/edit, driven by `map-store` refs `previewGoal` / `previewTourType` and the `updatePreview()` method.

GPX tracks are already rendered **selection-scoped** (`gpx-track-layer.ts`, keyed off the selected tour) — a good precedent: things tied to "the currently open tour" live outside the clustering source and update from `selectedTour`.

The `Tour` entity already carries `startPoint` / `endPoint` (`{ lng, lat } | null`) plus name/elevation. The info sheet renders **`home`** for start and **`flag`** for end (Material Symbols), and special-cases round trips (end == start) and one-way-to-goal tours (no end point).

## Goals / Non-Goals

**Goals:**
- Render saved start/end markers **only while a tour's info sheet is open** (own + partner friend tours), styled as the goal's sibling: same circle, tour-type color, centered white `home`/`flag` icon.
- Extend the existing goal-only draft-preview mechanism to start and end, so create/edit shows all set points and recolors changed points to the lighter draft tone, promoting drafts to saved on save.
- Keep the standard map and clustering strictly goal-only.

**Non-Goals:**
- No clustering, collision, or selection behavior for start/end markers — they are display-only.
- No schema change, no new persisted fields.
- No change to goal-marker completion/friend/link rendering, nor to GPX track rendering.

## Decisions

### D1: Mirror the goal's GL pipeline — a circle layer + an SDF symbol layer on a new selection-scoped source
The goal marker overlays its completion / friend / link icons as **GL `symbol` layers on a GL `circle` layer**, all on one GeoJSON source, filtered by feature property and z-ordered by insertion order (`tours-marker-layer.ts`). Start/end markers SHALL use the **same mechanism**, not a parallel DOM-marker system: a new **selection-scoped GeoJSON source** (`tour-detail`) carrying ≤2 point features, with one `circle` layer and one `symbol` layer over it.

- **Circle:** `circle-color` = `['case', ['get', 'draft'], PREVIEW_COLOR_EXPR, COLOR_EXPR]`; radius / opacity pulled from the **same constants** the goal circle uses (extract to a shared module so they cannot drift).
- **Symbol:** `icon-image` = `['match', ['get', 'pointKind'], 'start', HOME_ICON_ID, 'end', FLAG_ICON_ID]`. Author `home` and `flag` as white SVG glyphs registered via `addImage` exactly like `loadCheckIcon` (non-SDF white fill, since the icon is always white on the colored circle). These are simpler shapes than the existing two-person friend glyph.
- **No friend / completion symbol on this source** → start/end are unaffected by those states for free (issue requires identical start/end design regardless of friend/completion).
- **Z-order:** insert the detail circle + symbol layers **before** the goal layers (the `beforeId` trick the GPX layer already uses), so the goal stays on top; start/end sit above the GPX track, below the goal.

- **Why:** Reuses the established goal/check/friend/link pattern instead of a second rendering mechanism; circle parity with the goal is automatic (same layer type + shared paint constants) and z-order is just insertion order. No Material Symbols *font* dependency on the canvas.
- **Alternative considered:** DOM `maplibregl.Marker`s using the `material-symbols-outlined` font for exact glyph parity. Rejected: introduces a parallel render mechanism, forces hand-matching a DOM circle to the GL circle, complicates z-order against the GL goal, and depends on the icon font being loaded on the canvas.
- **Cost:** authoring `home` + `flag` as SVG glyphs (low risk — simpler than the existing friend glyph).

### D2: One render path for both create and detail/edit, fed a pre-resolved list
The clustering `tours` source is untouched → clustering / collision / the bare map stay goal-only by construction. `tours-marker-layer.ts` exposes `updateDetailMarkers(points)` that just `setData`s the `tour-detail` source. `tourenbuddy-map.vue` composes the resolved list:
- **a tour is selected** (detail / edit) → saved start/end from `selectedTour`, with per-point preview overrides;
- **else preview refs are set** (create — no selected tour exists) → purely the preview points.

The layer is ignorant of "selected vs creating"; it renders whatever resolved list it is given. Start/end therefore behave identically to the goal in create/detail, differing only in that they (a) never appear on the bare map with no tour selected and (b) are non-interactive.

- **Why:** Goal preview already renders independently of selection (`previewGoal`); collapsing create + detail into one resolved-list input avoids two parallel paths and keeps a single pure policy function authoritative.

### D3: Decide *which* markers to show in a pure function
The resolved list is computed by a **pure function** `tourDetailMarkers(tour | null, overrides?)` → `{ pointKind: 'start' | 'end', lngLat, tourType, draft }[]`. All policy — round-trip / one-way suppression, per-point saved-vs-draft, own-vs-friend (identical) — lives here, not in the renderer.

- **Why:** The policy holds the real edge cases (round trip, one-way, per-point draft override) and is the most valuable thing to unit-test in isolation (`testing.md` mandates edge-case tests). The renderer stays a thin `setData`.

### D4: Extend preview state from goal-only to goal + start + end (per-point draft)
Add `previewStart` / `previewEnd` refs (+ setters) to `map-store`, mirroring `previewGoal`. During edit/create, `map-page` sets only the **changed** point's preview; unchanged points fall back to the saved tour coordinate (full color). Entering edit with no pick yet leaves all points full-color; a re-pick flips **only that point** to the draft tone; cancel / unchanged drops the override.

- **Why:** Reuses the established draft lifecycle (survive the save round-trip, clear on cancel/fail) and matches the goal's per-point behavior — avoids the easy mistake of flipping all three points to draft on any edit.

### D5: Round-trip / one-way policy mirrors the info sheet
`tourDetailMarkers` shows the **start** marker whenever a start coordinate exists, and the **end** marker only when a **distinct** end coordinate exists (not equal to start, using the same `isSameGoal` / distance check the codebase already uses). Round trips and one-way-to-goal tours therefore get a start marker and no end marker.

### D6: A tap on a start/end marker is swallowed, never dismisses
The map background-click handler (`tourenbuddy-map.vue`) emits `mapBackgroundClick` (→ close info sheet / cancel creation) when `queryRenderedFeatures` over `TOUR_LAYER_IDS` returns nothing. Add the **detail circle layer id** to that query so a tap on a start/end marker registers a hit and is **swallowed** — no select, no fly-to (no click handler is wired on the layer), and crucially no deselect / cancel. This realizes "display-only" as "absorbs its own tap and does nothing", not "tapping it nukes the open surface".

## Risks / Trade-offs

- **Style switch tears down all layers** → the `currentStyleIndex` watcher re-runs `setup` + `updateTours` / `updatePreview`; the detail source/layers and the `home`/`flag` images must be (re-)created and `updateDetailMarkers` re-called there too. → Mitigation: add detail setup + update to every teardown / re-setup site, covered by a scenario.
- **Glyph drift from the info sheet** — hand-authored `home`/`flag` SVGs may not pixel-match the Material Symbols font glyphs. → Acceptable: same approach already used for check/friend/link; the icons read clearly as start/finish, which is the requirement.
- **Overlap when start/end sit near the goal or each other** → goal kept on top via insertion order; round-trip suppression removes the most common overlap. Display-only, so no ambiguous click target.
- **Two draft sources during create** (goal via `tours-preview`, start/end via `tour-detail`) → accepted minor redundancy; the existing goal-preview path is left untouched to avoid regression. Both use `PREVIEW_COLOR_EXPR`, so they stay visually consistent.
- **Friend-tour parity** — issue requires identical start/end design for friend tours. → The pure function ignores `isFriendTour` for start/end, so this is free.
