# Design

## Context

`BottomSheet` with `fitContent` re-measures its natural height on every content resize (`ResizeObserver` → `refit()`) and applies `min(natural, snap cap)`. The tour list passes `fit-content` + `resizable` on mobile. Search/filter state is module-level in `use-tour-filters.ts` (one state per tab) precisely so it survives the remount when the user opens a tour and comes back. Which sheet is visible is decided by `activeOverlay` in `map-page.vue`.

## Goals / Non-Goals

**Goals:** no sheet shrink while searching/filtering; reset on leaving the list.

**Non-Goals:** keyboard-aware sheet sizing (`visualViewport` tracking); resetting the remembered tab; the desktop side drawer's sizing (it is full height already).

## Decisions

- **`holdHeight` prop on `BottomSheet`, not a tour-list-specific hack:** the shrink originates in the generic refit; a grow-only clamp in `refit()` (`max(previous, fitted)`) is the smallest change and reusable. Drag release and snaps bypass `refit()`, so the user can still resize manually. Peek is exempt so a sheet parked at peek stays there. When the hold is released, the sheet refits immediately.
- **Hold condition = search query non-blank or any filter active** (tour list side). Holding only while the input is focused would shrink the sheet the moment the keyboard closes — the same jump, just later.
- **Reset lives in `map-page` on `activeOverlay` changes:** every way of leaving the list (close button/swipe/Escape emit `close`, the speed-dial dismiss calls `closeOverlay()` directly, menu items swap the overlay) funnels through `activeOverlay`. Rule: when it becomes anything other than `'tours'` or `'tour'`, reset. List → tour → back keeps state; list → tour → close resets.
  - Alternative rejected: clearing in `TourListSheet`'s `close` emit — misses the speed-dial dismiss and overlay swaps.
  - Alternative rejected: clearing on `TourListSheet` unmount — the list unmounts when a tour is opened from it, which must keep state.
- **`resetTourFilters()` is a module-level export** that clears both tabs' state directly (no store wiring), sharing the clear logic with `clearAll()`.

## Risks / Trade-offs

- [Held sheet taller than its content shows empty space under the rows] → intended; it is what keeps rows above the keyboard. Released when search/filters clear.
- [Calendar → "open tours" handoff remounts the map page] → state survives a calendar round-trip because the overlay was never closed; acceptable (not "closing").
