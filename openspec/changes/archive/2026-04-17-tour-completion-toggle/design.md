## Context

Tours today are stored with goal coords, type, dates, etc., and rendered on the map as colored circle markers (color by `tourType`). No notion of whether a tour has been done. Users want the map to double as a history view — completed vs. still-planned tours visually distinct, togglable from the info sheet.

Supabase `tours` table backs the domain entity via a Zod schema in `features/tours/data/models/`. Map markers come from a MapLibre GeoJSON source built from the tours store.

## Goals / Non-Goals

**Goals:**

- Persist a `completed: boolean` per tour (default `false`).
- Toggle completion from the tour info sheet via a rounded checkbox control placed alongside edit and delete actions at the bottom-right of the sheet. When completed, control displays a green checkmark.
- Instant toggle — no confirmation dialog for marking or unmarking.
- Only the tour owner can toggle completion. Enforced server-side via existing Supabase RLS (owner-only update policy on `tours`) and reflected in the UI (control hidden or disabled for non-owners).
- Map marker reflects completion state immediately after toggle; selected-highlight (larger radius + white stroke) still applies, and the check glyph still renders on selected completed tours.
- Round-trip toggling (mark/unmark) supported without restrictions.
- Debug-only logging of toggle events via `useLogger` — no user-facing log output.

**Non-Goals:**

- Completion timestamps, completion notes, multi-completion history.
- Per-partner completion tracking.
- Filtering / sorting / sectioning tour lists by completion state — decided later.
- Distinct GPX track styling for completed tours — track renders identically regardless of completion.
- Statistics / counters.
- Confirmation dialog when unmarking.

## Decisions

### Data model: single `completed` boolean, not a status enum

Boolean is sufficient for the two-state UX described in the issue. A status enum (`planned | in-progress | completed | skipped`) would be over-engineering without concrete product need. Easy to widen later if needed.

**Alternative considered:** `completed_at: timestamp` nullable. Rejected — issue only asks for a checkmark/unmark. Timestamp adds clock-consistency concerns and no current UI consumer. Can be added non-breakingly later.

### Repository: reuse existing update path

Extend the existing tour update method (e.g. `updateTour`) to accept partial patches including `completed`. Avoid a narrow `markCompleted` RPC to keep the repository surface small and consistent with how other tour fields mutate.

**Alternative considered:** dedicated `setCompleted(id, value)` on the repository. Rejected — duplicates the general update path.

### Store action: optimistic with rollback on failure

`toursStore.setCompleted(tourId, value)` flips the local tour record immediately, calls the repository, and rolls back on error while surfacing through the store's `error` ref. Matches the reactivity expected by the map marker layer and keeps the UI snappy on free-tier Supabase latency.

### Marker visualization: check glyph via symbol layer atop circle

MapLibre cannot render a glyph inside a `circle` layer paint. Add a sibling `symbol` layer with a `check` icon filtered to features where `completed == true`. Circle layer color stays type-driven; selected state (larger radius + white stroke) still applies to completed tours, and the glyph renders on top regardless. Grayscale-mixed circle color is the fallback path if the symbol approach is blocked.

Implementation preference: try Material Symbols webfont via MapLibre glyph endpoint first during a short spike. If not trivially wired, bundle a single check SVG into a sprite JSON under `public/` and reference it as the symbol layer's `icon-image`. Manual test must confirm the glyph renders crisply at default and selected sizes before merge.

**Fallback — grayscale mix:** if both glyph paths are blocked, use a data-driven circle-color expression that mixes the type color with grey (`interpolate-hcl` or pre-computed grayscale variants per type). Not preferred because it loses type encoding legibility, but ships the feature.

**Alternative considered:** swap color entirely when completed (e.g. all-green). Rejected — loses tour-type encoding.

### GeoJSON feature properties

Add `completed: boolean` to each feature's properties alongside `tourType`. Circle + symbol layers both read it. Map store need not learn about completion — it's purely a render-time property.

## Risks / Trade-offs

- [MapLibre symbol layer icon sprites require build-time setup] → Use existing Material Symbols webfont if already loaded; otherwise bundle a single check SVG in a sprite JSON under `public/`. If neither proves quick, ship the desaturation fallback first, iterate.
- [Optimistic update diverges from DB on failure] → Rollback path + `error` ref surfaced via snackbar (already pattern in stores).
- [Existing RLS policies on `tours` table may not allow the new column] → Supabase migration adds the column with default; update policies only if column-level restrictions exist (typical setup uses row-level only).
- [Preview marker in edit mode] → Not affected; completion toggle is outside edit flow.

## Migration Plan

1. Supabase migration: `ALTER TABLE tours ADD COLUMN completed boolean NOT NULL DEFAULT false;`
2. Deploy frontend — old clients keep working (ignore new column).
3. No data backfill — default is correct for all existing rows.

Rollback: drop the column; frontend tolerates missing field via Zod default.

## Open Questions

- Glyph source: Material Symbols webfont via MapLibre glyphs endpoint vs. bundled SVG sprite — resolved at implementation time via the spike in task 5.2. Manual test step required either way.
- Exact green used for the completed-state checkmark control: prefer existing success/accent token if present in `theme/tokens.css`, otherwise introduce `--color-success` (green) with a light/dark variant. Confirm during PR review.
