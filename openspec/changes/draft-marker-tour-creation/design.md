## Context

Edit mode already renders a lighter-tone draft preview marker via `mapStore.editPreviewGoal` + `useToursMarkerLayer().updatePreview(goal, tourType)` (`tours-marker-layer.ts:779`). In edit mode `tourenbuddy-map.vue` derives the preview color from `selectedTour.value?.tourType`. Tour creation has no selected tour, so that derivation yields `null` (neutral) and, more importantly, creation never sets a preview goal today — `map-page.vue` only tracks `pendingLocation` for the form.

This change reuses that exact mechanism for creation. Camera behavior is deliberately left untouched: `flyToSelectedTour` already pads the mobile fly-to by `sheetContainerRef.offsetHeight` (`map-page.vue:377`), which centers the marker in the remaining map space above the sheet on open, and there is no drag-watcher or `ResizeObserver`, so the camera stays put while the sheet is dragged (important so GPX tracks shown alongside the marker don't get pushed out of view).

## Goals / Non-Goals

**Goals:**
- Show a single draft marker during creation, moving on goal re-pick, neutral until an activity type is chosen, then live-following that type's lighter shade.
- Transform the draft into the real marker on save (the light draft stays on screen through the create round-trip and swaps to the full-color marker); clear it on cancel.
- Primarily a **desktop** improvement — the map is always visible beside the side-panel form there. On mobile the full-screen creation form means the draft is only seen during goal re-pick and after save; that is accepted.

**Non-Goals:**
- No camera changes. The existing `bottom: sheetHeight` fly-to already centers the marker in the remaining space on open and intentionally does not re-fly when the sheet is dragged or resizes.
- No camera repositioning during creation/edit on mobile (the form is full-screen — nothing to position around).
- No change to the marker rendering layer (`updatePreview` already does what we need).

## Decisions

### Generalize the preview state in `map-store`, don't fork a creation-only path
Rename `editPreviewGoal`/`setEditPreviewGoal` → `previewGoal`/`setPreviewGoal` and add a `previewTourType` ref + `setPreviewTourType`. Both edit and creation write the same two refs. `tourenbuddy-map.vue` then watches `[previewGoal, previewTourType]` and calls `updatePreview(previewGoal, previewTourType)`, dropping its current dependency on `selectedTour.tourType` inside the watch.

- **Why:** one mechanism, one cleanup path, no duplicated marker source. The color source becomes explicit instead of implicitly piggy-backing on the selected tour.
- **Alternative considered:** keep `editPreviewGoal` and add a separate `creationPreviewGoal` — rejected: two sources for one visual marker invites double-marker bugs and duplicate clear logic.
- **Edit-mode adjustment:** where edit mode previously relied on `selectedTour.tourType`, it now also calls `setPreviewTourType(selectedTour.tourType)` when entering the tentative pick, preserving behavior.

### The form's live activity type flows up via events, not direct store writes
`tour-form.vue` already holds `selectedTourType` and watches it. Add an emit (`tourTypeChange`) on that change; `tour-creation-dialog.vue` re-emits; `map-page.vue` calls `mapStore.setPreviewTourType(type)`.

- **Why:** `tours` feature writing into the `map` store is an inward cross-feature dependency the architecture discourages. `map-page.vue` already orchestrates the creation flow and owns the map store interaction, so routing the type through it keeps the dependency direction clean (presentation orchestrator → map store).
- **Alternative considered:** `tour-form` writes `mapStore.setPreviewTourType` directly — rejected on module-boundary grounds.

### Set preview goal alongside existing `pendingLocation` transitions in `map-page.vue`
- Set `setPreviewGoal(location)` on the initial creation goal pick and on goal re-pick (the two branches at `handleLocationConfirmed`, ~`map-page.vue:468,484`).

### Clear timing: late on save (transform), immediate on cancel
The save path runs `handleTourCreated → closeOverlay() → await performCreate()`, and `createTourFromDraft` does `await loadTours()` before returning — so the real marker only exists *after* the round-trip. Clearing the preview in `closeOverlay`/`resetTourCreationState` (the natural single point) would blank the marker during create latency (Supabase free tier — noticeable), breaking the "transforms into the saved marker" intent.

Resolution:
- Put the preview clear (`setPreviewGoal(null)` + `setPreviewTourType(null)`) in `resetTourCreationState()` so **every** cancel/dismiss path (`closeOverlay`, `openOverlay` switching away) clears immediately. This keeps one clear point for all non-save exits.
- On the **save** path only, re-assert the preview *after* `closeOverlay()` in `handleTourCreated` using the already-captured `goal` and `draft.tourType` (`setPreviewGoal(goal)` + `setPreviewTourType(draft.tourType)`), so the light colored draft stays visible through `performCreate`.
- Clear the preview at the **end of `performCreate`**, after `createTourFromDraft` resolves (the real full-color marker is now in the store) — the draft visibly swaps to the saved marker, no empty-map gap.

- **Why re-assert rather than fork `closeOverlay`:** `closeOverlay` is shared by cancel and save; re-asserting the captured goal in the single save handler is one line and keeps `closeOverlay` as the universal cancel-clear, avoiding a `savingInProgress` flag.
- **Alternative considered (and rejected):** keep preview clearing out of `resetTourCreationState` and clear explicitly in each cancel path — rejected: enumerates more sites and risks a leak if a new dismiss path is added later.

### Camera unchanged (explicitly)
The mobile fly-to keeps `bottom: sheetContainerRef.offsetHeight`. With `top: 0`, this centers the goal at `(H − sheetHeight)/2` — exactly halfway between the screen top and the sheet's top edge — on open, for any fit-content sheet height. The camera is intentionally **not** re-flown on sheet drag or content-driven resize.

- **Why:** the marker is the main tour goal and should sit in the remaining map space when the sheet opens; the map stays freely navigable afterward, and a re-fly on drag/resize would be jarring and could push an accompanying GPX track out of view.
- **Alternative considered (and rejected):** a fixed `bottom: 0.7 * H` to pin the marker at ~15% from top — rejected because with short fit-content sheets it leaves a large empty gap between marker and sheet; dynamic centering reads better. A `ResizeObserver`-driven re-fly was also rejected for the jarring-camera reason above.

## Risks / Trade-offs

- **Stale preview after save if the late clear is missed** → the re-assert (save path) and the clear at the end of `performCreate` are in the same handler; if `createTourFromDraft` throws, `performCreate` must still clear the preview (clear in a `finally` or before the early return) so a failed create doesn't leave a dangling draft. Cancel paths remain covered by `resetTourCreationState`.
- **Re-assert depends on capture order** → `handleTourCreated` already captures `goal` before `closeOverlay()` (`map-page.vue:582`); the re-assert must run after `closeOverlay()` (which clears via `resetTourCreationState`) and use that captured `goal` + `draft.tourType`, not the now-cleared store/`pendingLocation`.
- **Rename touches edit-mode call sites** → small, mechanical; `grep editPreviewGoal` enumerates all 7 references. Type-check + existing edit-mode behavior is the safety net.

## Open Questions

None — scope and behavior confirmed with the issue author: desktop-focused; draft marker during creation with live recolor; late clear on save (transform); no camera changes.
