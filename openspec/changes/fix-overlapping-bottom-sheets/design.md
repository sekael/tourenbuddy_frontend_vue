## Context

`MapPage` currently tracks four independent overlay visibility flags:

- `showFeedbackSheet: Ref<boolean>`
- `showProfileSheet: Ref<boolean>`
- `showContactDialog: Ref<boolean>`
- `selectedTour` derived from `mapStore.selectedTourId`

Each is set independently by the corresponding open trigger (`MapActionOverlay` events for the first three, `handleTourClicked` for the fourth). Nothing prevents multiple flags being `true` simultaneously, so the user can open the feedback sheet, then click a tour marker, then open the contacts sheet, ending up with three overlays stacked on each other and ambiguous focus / backdrop semantics.

The desktop layout aggravates the problem: the feedback / profile / contacts sheets render via `BottomSheet` (which becomes a centered dialog with backdrop), while `TourInfoSheet` renders inside a `SideDrawer`. Stacking those produces both a centered dialog and a side drawer — a particularly broken state.

## Goals / Non-Goals

**Goals:**

- Guarantee at most one overlay is rendered at any time.
- Centralize overlay state on `MapPage` so future overlays opt into the mutual-exclusion contract by construction (one helper to call instead of "remember to flip three other flags").
- Preserve all existing behaviors: map-background-click closes the active overlay; map-action-overlay buttons toggle their respective sheets; tour markers open the tour info overlay.

**Non-Goals:**

- No animation/transition rework. The existing `<Transition name="sheet">` wrappers stay.
- No change to `BottomSheet`/`SideDrawer` internals. Mutual exclusion is enforced at the orchestration layer.
- No change to `mapStore.selectedTourId` — it remains the source of truth for _which_ tour is selected. Visibility of the tour info overlay is gated through `activeOverlay`.
- No change to `TourCreationDialog` behavior. It is a non-modal-bottom-sheet dialog driven by an independent flow (location pick → dialog) and is not part of the overlapping-sheets bug. Out of scope.

## Decisions

### Decision: Single `activeOverlay` ref + helpers, not per-overlay watchers

Replace the four boolean flags with one `activeOverlay: Ref<OverlayName | null>` where `OverlayName = 'feedback' | 'profile' | 'contacts' | 'tour'`. Provide two helpers:

```ts
function openOverlay(name: OverlayName) {
  if (activeOverlay.value === name) return
  if (activeOverlay.value === 'tour' && name !== 'tour') {
    mapStore.selectTour(null)
    mapStore.setEditPreviewGoal(null)
  }
  activeOverlay.value = name
}

function closeOverlay() {
  if (activeOverlay.value === 'tour') {
    mapStore.selectTour(null)
    mapStore.setEditPreviewGoal(null)
  }
  activeOverlay.value = null
}
```

Tour selection is integrated by:

- `handleTourClicked(id)` calls `mapStore.selectTour(id)` then `openOverlay('tour')`.
- A `watch(selectedTourId)` keeps `activeOverlay` in sync if the store is mutated externally (e.g. `closeTourInfo` already calls `mapStore.selectTour(null)`): when `selectedTourId` becomes non-null, set `activeOverlay = 'tour'`; when it becomes null and `activeOverlay === 'tour'`, set `activeOverlay = null`.

Computed booleans (`showFeedbackSheet`, etc.) drive the existing `v-if` template — minimal template churn.

**Alternatives considered:**

- _Per-overlay watchers_ (when one flag flips true, watchers flip the others false). Rejected: N×N coupling, hard to extend, race-prone on simultaneous opens.
- _Move state into `mapStore` or a new `overlay-store`_. Rejected for now: only `MapPage` consumes this state; promoting to a store adds indirection without callers. If a second feature needs to read it, promote then.

### Decision: Treat tour selection as the canonical "tour overlay" trigger

`mapStore.selectedTourId` is already the source of truth for which tour is shown. Rather than introducing a parallel "tour overlay open" flag, the watch keeps `activeOverlay` in sync with `selectedTourId`. This means `closeTourInfo` continues to call `mapStore.selectTour(null)` and the watcher closes the overlay; no second code path to maintain.

### Decision: Explicit `editPreviewGoal` reset on switch-away

When `activeOverlay` switches from `'tour'` to anything else, the helper also clears `mapStore.setEditPreviewGoal(null)`. This mirrors `closeTourInfo` so an in-progress edit doesn't leak its preview marker onto the map after the user opens a different sheet.

## Risks / Trade-offs

- **Risk**: Existing callers that flip the old booleans directly (e.g. `handleMapBackgroundClick` setting all three to `false`) must be migrated. → Mitigation: search-and-replace is mechanical; tests added in the tasks phase cover each open/close path.
- **Risk**: The `selectedTourId` watcher could fire before `openOverlay('tour')` runs in `handleTourClicked`, briefly showing the tour overlay while another sheet is still in the DOM. → Mitigation: `handleTourClicked` sets the overlay in the same tick (synchronously after `selectTour`), and the watcher is idempotent — both end with `activeOverlay = 'tour'` and the previous overlay closed.
- **Trade-off**: `activeOverlay` is local to `MapPage`. If the routing layer ever needs to open a sheet (e.g. deep link to feedback), it will need to either route through `MapPage` or this state must be promoted to a store. Acceptable for now; documented above.
