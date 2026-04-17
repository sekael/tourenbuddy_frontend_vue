## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/17-tour-completion-toggle`

## 2. Database

- [x] 2.1 Add Supabase migration adding `completed boolean NOT NULL DEFAULT false` to `tours` table
- [x] 2.2 Confirm existing owner-only RLS update policy on `tours` covers the new column (no column-level restriction); adjust if needed

## 3. Data layer

- [x] 3.1 Add `completed` field to Zod tour schema in `src/features/tours/data/models/` with default `false`
- [x] 3.2 Update inferred `Tour` / `TourDraft` / update-payload types to include optional `completed`
- [x] 3.3 Update Supabase repository mapping (row ↔ entity) to round-trip `completed`
- [x] 3.4 Ensure the existing tour update method accepts a `completed` patch

## 4. Domain & store

- [x] 4.1 Add `completed` to the tour domain entity
- [x] 4.2 Add `setCompleted(tourId, value)` action to the tours Pinia store with optimistic update + rollback on error
- [x] 4.3 Emit a debug-level log via `useLogger` on toggle (tour id + new value); no higher-severity logs on success
- [x] 4.4 Populate store `error` ref on repository failure (existing pattern)

## 5. Map marker rendering

- [x] 5.1 Include `completed` in per-tour GeoJSON feature properties in the map marker source builder
- [x] 5.2 Spike: render check glyph on completed markers. First attempt Material Symbols via MapLibre glyphs endpoint; if blocked, add sprite JSON with a single check SVG under `public/` and reference as `icon-image`
- [x] 5.3 Add symbol layer for the check glyph, filtered `['==', ['get', 'completed'], true]`, rendered above the circle layer
- [x] 5.4 Verify selected-state styling (larger radius, white stroke) still applies to completed tours and the glyph renders on top
- [x] 5.5 If 5.2 and 5.3 prove infeasible within one implementation session, implement grayscale-mix fallback via a data-driven circle-color expression (type color mixed with grey)
- [x] 5.6 Verify GPX track style is unchanged for completed tours (manual)
- [x] 5.7 Verify marker updates reactively when `completed` flips in the store (manual)

## 6. Tour info sheet

- [x] 6.1 Add rounded checkbox-style toggle control to the bottom-right action row of the tour info sheet, alongside edit and delete buttons
- [x] 6.2 Completed state displays a green checkmark (reuse existing success/accent token; add `--color-success` if absent); not-completed state displays an empty rounded box
- [x] 6.3 Gate the toggle to tour owners only (hide or disable for non-owners, consistent with edit/delete gating)
- [x] 6.4 Wire the control to `setCompleted` store action, instant toggle (no confirmation dialog) in both directions
- [x] 6.5 Confirm error surfacing through existing snackbar/error pattern

## 7. Tests

- [x] 7.1 Unit test: tours store `setCompleted` updates state optimistically and rolls back on repository rejection
- [x] 7.2 Unit test: store emits debug log on toggle via mocked logger
- [x] 7.3 Unit test: Zod schema defaults `completed` to `false` when field absent; round-trips true/false
- [x] 7.4 Component test: info sheet toggle invokes store action, reflects state, hidden/disabled for non-owner
- [x] 7.5 Unit test: marker feature builder includes `completed` property on each feature

## 8. Manual verification

- [x] 8.1 Run `npm run dev`; create a new tour, toggle completion from info sheet — marker updates immediately with check glyph (or grayscale fallback)
- [x] 8.2 Select a completed tour — confirm selected-state ring renders and check glyph is still visible
- [x] 8.3 Verify GPX track on a completed tour renders identically to not-completed
- [x] 8.4 Attempt toggle as a non-owner (e.g. second account viewing a shared tour if applicable) — control hidden/disabled; direct repository update rejected by RLS
- [x] 8.5 Confirm no user-facing console logs; debug log visible only when logger level set to debug

## 9. Finalize

- [x] 9.1 Run `npm run lint` and `npm run format` — zero warnings
- [x] 9.2 Run `npm run type-check` and `npm run test` — all pass
- [ ] 9.3 Prompt user to commit with conventional message: `feat(tours): add completion toggle with map marker distinction (#17)`
- [ ] 9.4 Prompt user to push branch and open PR against `main` referencing issue #17
- [ ] 9.5 After merge, prompt user to archive this change via the `openspec-archive` skill
