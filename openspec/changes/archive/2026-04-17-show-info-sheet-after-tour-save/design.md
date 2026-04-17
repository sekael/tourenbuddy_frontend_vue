## Context

Tour creation lives in `map-page.vue`. `handleTourCreated` closes the dialog and calls `toursStore.createTourFromDraft(draft, pendingLocation)` (void). After save the user sees the map with no open overlay. Selecting any tour id already triggers two existing behaviors via watchers: `activeOverlay` becomes `'tour'` (opens the info sheet) and `flyToSelectedTour` centers the map with zoom 12. We just need to select the new tour id right after save.

## Goals / Non-Goals

**Goals:**

- Auto-open the info sheet for the newly created tour.
- Reuse existing fly-to-and-select behavior; no new animation or overlay code.

**Non-Goals:**

- Changing the creation dialog itself.
- Changing repository behavior — the repository already returns success.
- Changing behavior of the edit flow.

## Decisions

**Return the new id from the store, not the repository or a new event.**

- The store already owns UUID generation (`uuidv4()` in `createTourFromDraft`).
- Returning the id from the store is the smallest surface change and keeps the map page as the single place that coordinates overlay state.
- Alternative: emit a `tour-created` event from the dialog or store. Rejected — adds machinery for something the caller already awaits.

**Select the tour after `loadTours()` completes.**

- `createTourFromDraft` awaits `loadTours()` before returning, so the new tour is guaranteed to be in `tours.value` when the caller selects it.
- This means `selectedTour` computed resolves immediately and `flyToSelectedTour` finds its target.

**Return `null` when unauthenticated.**

- Matches the existing early-return branch in the store.
- Caller guards with `if (newId)` before selecting, so no overlay opens on failed create.

## Risks / Trade-offs

- [Risk: `loadTours()` fails after repository create succeeds] → `createTourFromDraft` would throw before returning the id, so no selection happens; user must refresh. Acceptable; same behavior as today.
- [Risk: map is in the middle of a location pick when create completes] → Not reachable — the dialog blocks the picker, and `handleTourCreated` runs after dialog close.
