## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/223-tour-detail-start-end-markers`

## 2. Detail-marker policy (pure function + tests)

- [x] 2.1 Add a pure function `tourDetailMarkers(tour, draft?)` (e.g. in `src/features/tours/domain/`) returning the start/end markers to render as `{ kind: 'start' | 'end', lngLat, tourType, draft }[]`: start whenever a start coordinate exists; end only when a distinct end coordinate exists (reuse the existing `isSameGoal`/distance check); draft overrides per point fall back to the saved tour coordinate. Friend status SHALL NOT affect output.
- [x] 2.2 Unit-test the edge cases in `test/features/tours/...`: round trip (end == start → start only), one-way (no end → start only), distinct end (both), no start (none), draft override changes one point while the other stays saved. (Per testing.md: cover edge/failure cases, skip the trivial happy path.)

## 3. Marker layer renderer (GL, mirroring the goal)

- [x] 3.1 Author `home` (start) and `flag` (end) as white SVG glyphs and register them via `addImage` in `tours-marker-layer.ts`, following `loadCheckIcon` (non-SDF, white fill).
- [x] 3.2 Add a selection-scoped `tour-detail` GeoJSON source with a `circle` layer (`circle-color` = `['case', ['get','draft'], PREVIEW_COLOR_EXPR, COLOR_EXPR]`, radius/opacity from shared constants extracted so they cannot drift from the goal) and a `symbol` layer (`icon-image` = `['match', ['get','pointKind'], 'start', HOME_ICON_ID, 'end', FLAG_ICON_ID]`). Insert both layers BEFORE the goal layers (the `beforeId` pattern the GPX layer uses) so the goal stays on top.
- [x] 3.3 Expose `updateDetailMarkers(points)` that `setData`s the source from a resolved list `{ pointKind, lngLat, tourType, draft }[]`; clear the source in `cleanup()` and re-create the source/layers + re-call it in the style-switch (`currentStyleIndex`) re-setup path.
- [x] 3.4 Add the detail circle layer id to the background-click `queryRenderedFeatures` in `tourenbuddy-map.vue` so a tap on a start/end marker is swallowed (no select, no dismiss, no cancel).

## 4. Preview state + wiring

- [x] 4.1 Extend `map-store` with `previewStart` / `previewEnd` refs and setters mirroring `previewGoal`; reset them on the same cancel/dismiss paths in `map-page.vue` (`resetTourCreationState`, overlay close).
- [x] 4.2 In `tourenbuddy-map.vue`, build the resolved list via `tourDetailMarkers(...)`: when a tour is selected, saved start/end with per-point preview overrides; otherwise (create) purely the preview points. Call `markerLayer.updateDetailMarkers(...)`; watch `selectedTour` + preview refs; include it in the style-switch re-setup path alongside `updateTours`/`updatePreview`.
- [x] 4.3 In `map-page.vue` / `tour-form.vue`, drive `previewStart` / `previewEnd` during create/edit when a start/end location is picked or changed (only the changed point flips to draft), and ensure drafts clear/promote on the same save and cancel paths the goal already uses.

## 5. Manual verification

- [ ] 5.1 Verify against local Supabase: open an own tour's details → saved start/end markers appear with correct icons/colors; standard map shows none; round-trip/one-way show start only; partner friend tour shows identical markers; completing a tour leaves start/end unchanged; edit a start/end → lighter draft marker, save promotes it, cancel reverts; style switch re-renders markers.

## 6. Finalize

- [x] 6.1 Run `npm run test`, `npm run type-check`, and `npx eslint . --fix` — all green, zero warnings.
- [ ] 6.2 Prompt the user to commit with a ready-to-copy conventional commit message (e.g. `feat(map): show start and end markers when viewing tour details (#223)`).
- [ ] 6.3 Prompt the user to push the branch and open a PR to `main`.
- [ ] 6.4 Prompt the user to archive this change with the `openspec-archive` skill once merged.
