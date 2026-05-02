## Context

`tour-form.vue` was built around summit tours: end-point falls back to start, start falls back to end (`effectiveStartPoint` / `effectiveEndPoint`). Goal picking is the only flow that fetches name + elevation from Swisstopo. Goal picker has no header, so once the form collapses for picking the user has no on-screen reminder of what they are picking. Start/end points are stored as bare `{ lng, lat }` with no auto-derived metadata.

Issue #92 wants tours that begin at A, end at B, and target goal C — typical for traverses, ski tours, point-to-point hikes.

## Goals / Non-Goals

**Goals:**

- Goal picker visually announces "Tour Goal" / "Tourenziel".
- End point is opt-in; default null = one-way tour from start to goal.
- Start and end picks reuse the goal-pick flow for elevation + name lookup.
- Form and info sheet display the fetched metadata next to coordinates.

**Non-Goals:**

- Routing or distance computation between start/goal/end.
- Re-fetching metadata on edit if coordinates unchanged.
- Backfilling metadata for existing rows in the database.

## Decisions

### 1. Pick-type label reuses existing collapsed sheet/drawer header

While picking, `tour-creation-dialog.vue` and `tour-info-sheet.vue` already collapse the surrounding `AdaptiveOverlay` to a header-only band — `BottomSheet` on mobile, `SideDrawer` (top-right compact header) on desktop. The pick-type label is rendered as that collapsed header's title:

- mobile → bottom sheet title row reads "Tour Goal" / "Start Point" / "End Point"
- desktop → side-drawer collapsed header bar shows the same label

Implementation: thread the active `pendingPickType` from `map-page.vue` into both overlays as a prop, and replace the current `pickingTitle` computed (which interpolates the tour name) with a per-pick-type lookup:

- `goal` → `tours.picker.goalTitle` ("Tour Goal" / "Tourenziel")
- `start` → `tours.picker.startTitle` ("Start Point" / "Startpunkt")
- `end` → `tours.picker.endTitle` ("End Point" / "Endpunkt")

`location-picker.vue` itself stays unchanged — no in-canvas title bar, no overlap with crosshair, no extra layout work for safe areas / landscape. The chrome the user already sees does the announcing.

Alternatives considered:

- Title bar inside `location-picker.vue` (original plan): rejected — duplicates the existing collapsed-header surface and competes with it visually.
- Per-type pickers: rejected — duplicates crosshair + actions code.

### 2. Drop `effectiveStartPoint` / `effectiveEndPoint`

Form persists `startPoint` and `endPoint` exactly as picked. End = null is a valid, distinct state ("one-way to goal"). The "Add end point" affordance reveals the row; removing the end point hides it again.

Alternative: keep the fallback behind a feature flag. Rejected — extra branching with no migration value (no persisted draft format change).

### 3. Reuse the existing parallel-lookup pattern in `map-page.vue`

`handleLocationConfirmed` already calls `Promise.all([getElevation, suggestTourName])` for goal picks. Apply the same call for `start` and `end` picks. Pass results into `tour-form` via two new initial props (`initialStartPointMeta`, `initialEndPointMeta`) carrying `{ name, elevation }`.

Alternative: have `tour-form` itself trigger Swisstopo on receiving a coordinate. Rejected — `tour-form` should remain presentation-only and not own service calls.

### 4. Persist metadata on the tour row

Add `start_point_name`, `start_point_elevation`, `end_point_name`, `end_point_elevation` columns + view fields + RPC params. Storing avoids a re-lookup on every render of the info sheet and lets users edit the auto-filled name (consistent with how goal name + elevation are persisted today).

Alternative: derive on read. Rejected — Swisstopo dependency on a hot path; no offline support.

### 5. Form section visibility

`endPoint === null` → render an "Add end point" button row. Clicking transitions to the full end-point row (pick button). The "remove" affordance on the end-point row clears `endPoint` and the metadata, returning to the collapsed state. Start-point row is always rendered.

## Risks / Trade-offs

- **DB migration required for new columns** → Coordinate with backend; ship FE behind feature-detection only if migration timing is uncertain. Default plan: migration ships before FE merges.
- **Existing tours have null metadata for start/end** → Info sheet renders only when present; coordinates remain shown either way.
- **Swisstopo rate limits if user re-picks rapidly** → Existing services already throttle; no new pressure (one extra call per pick at most).
- **Collapsed header band hides when picking from edit-mode info sheet on tall screens** → existing collapse path already handles this for the goal pick; verify start/end picks behave identically.

## Migration Plan

1. Land DB migration adding the four metadata columns + view + RPC params (backend repo).
2. Merge schema + repository updates (still backward compatible: nulls everywhere).
3. Merge UI changes: form, info sheet, picker title bar.
4. No data backfill — historical rows simply lack metadata.

Rollback: revert FE PR; nullable columns are safe to leave in place.

## Open Questions

- Should the form allow manual edits to the auto-filled start/end names, mirroring the goal name field? Default: yes (consistency).
- Should `tour-info-extended` show "One-way" vs "Round trip" indicators when end is null? Current spec says "Round trip" for null end + present start; new semantics may want "One-way to goal" instead. Resolution deferred to spec delta.
