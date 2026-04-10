## Context

All modal bottom sheets in the app are mounted on `map-page.vue` as siblings of `TourenbuddyMap`. Their visibility is controlled by parent refs (`selectedTour`, `showFeedbackSheet`, `showProfileSheet`). The map is a MapLibre GL JS instance exposed via `mapRef.value.map`. Sheets currently close only via their internal close buttons, which emit `@close` to the parent.

The three existing sheets are visually inconsistent today:

- `tour-info-sheet.vue` and `user-profile-sheet.vue` use a `--color-background` surface with a border, drag handle, top-right icon close button, and `min-width: 300px` (no max-width).
- `feedback-sheet.vue` uses a `--color-surface` background with no drag handle, no header, `max-width: 480px`, and a text "Close" button at the bottom of the content.

This makes the new "click-outside-to-close" behavior a good moment to unify the visual contract.

## Goals / Non-Goals

**Goals:**

- A discrete tap/click on the map background dismisses any open modal bottom sheet.
- Behavior is uniform across all bottom sheets currently hosted by `map-page.vue`.
- Sheet content interactions and map gestures (pan/zoom/rotate) are unaffected.
- Tour-marker clicks still open/switch tour info sheets.
- All modal bottom sheets share a single visual/interaction contract: identical sizing rules, identical surface treatment, and the same explicit close control in addition to tap-outside-to-dismiss.

**Non-Goals:**

- Redesigning the per-sheet content layouts (only the wrapper changes).
- Animating or rebuilding the slide-up `Transition` (kept as-is in `map-page.vue`).
- Dismissing non-modal popovers, the location picker, or `ContactCreationDialog`/`TourCreationDialog` (those are dialogs, not bottom sheets).

## Decisions

### Decision 1: Emit a `map-click` event from `TourenbuddyMap`

Add a `click` listener on the MapLibre map instance in `tourenbuddy-map.vue`. When the click does NOT hit a tour marker layer (use `map.queryRenderedFeatures(e.point, { layers: [<tour-layer-ids>] })`), emit a `map-background-click` event. Marker clicks continue to emit `tour-clicked` as today.

**Alternatives considered:**

- Listening on the map container DOM element via `@click` in the template — rejected because it cannot distinguish marker hits from background hits and would fire even when the click started on a sheet that overlays the map.
- Using a global document click listener with `contains()` checks — rejected; brittle, and conflicts with map gesture handling.

### Decision 2: Centralize dismissal in `map-page.vue`

`map-page.vue` already owns all sheet visibility state. It handles `@map-background-click` by closing whichever sheet is currently open (`selectedTour`, `showFeedbackSheet`, `showProfileSheet`). Closing precedence: at most one sheet should be open at a time, but if multiple are open, close all of them on a single background click.

**Alternatives considered:**

- A shared composable `useDismissOnMapClick` — premature abstraction for three sheets that already share a parent.

### Decision 3: Sheets do not need pointer-event changes

Because the dismiss signal originates from MapLibre's own click handler (not a document listener), clicks landing on a sheet element never reach the map and so never trigger dismissal. No `stopPropagation` plumbing required.

### Decision 4: Introduce a shared `BottomSheet` wrapper component

Create `src/core/components/bottom-sheet.vue` that owns the consistent visual contract and the close button. Each feature sheet becomes a thin content component wrapped in `<BottomSheet :title="..." @close="...">`.

**Contract enforced by the wrapper:**

- Width: `width: 100%`, `max-width: var(--bottom-sheet-max-width, 480px)`, centered horizontally via the existing `.sheet-container` flex parent on `map-page.vue`.
- Height: `max-height: min(85vh, 720px)`; content area uses `overflow-y: auto` so tall sheets scroll internally instead of pushing the viewport.
- Surface: `background-color: var(--color-background)`, `border-radius: var(--radius-lg) var(--radius-lg) 0 0`, `box-shadow: var(--shadow-lg)`, `border-top: 1px solid var(--color-outline-variant)`.
- Header: a fixed-position header row with an optional `title` prop (rendered as `<h2>`) on the left and an icon close button on the right (`material-symbols-outlined: close`, 32×32 round button matching the existing `tour-info-sheet` styling). A drag handle sits above the header.
- Padding: shared `var(--spacing-lg)` inset on all inner content via a default `<slot />`.
- A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` linked to the title when provided, close button labeled "Close".

**Props/emits:**

- Props: `title?: string`, `ariaLabel?: string` (fallback when no visible title).
- Emits: `close` — fired by the header close button. Tap-outside-to-close is handled by `map-page.vue` and does not flow through the wrapper.

**Refactor of existing sheets:**

- `tour-info-sheet.vue`: replaces its `.sheet`, `.drag-handle`, `.header`, and `.close-btn` styles with `<BottomSheet :title="displayName" @close="emit('close')">`. Internal `.details` block remains.
- `user-profile-sheet.vue`: replaces wrapper/header/close styles; passes `title="Profile"`.
- `feedback-sheet.vue`: drops the bottom-of-content text "Close" button; wraps in `<BottomSheet title="Feedback" @close="emit('close')">`. The `ErrorSnackbar` stays as a sibling outside the sheet.

### Decision 5: Distinguish click from drag

Rely on MapLibre's built-in `click` event, which only fires for taps without drag. Pan/zoom gestures will not trigger dismissal.

## Risks / Trade-offs

- [Risk] Tour marker layer IDs must be kept in sync between the click handler and the layer definitions → Mitigation: export the layer ID constants from a single module already used to register the layers.
- [Risk] If a future sheet is added but `map-page.vue` is not updated, it will not auto-dismiss → Mitigation: document the pattern in `map-page.vue` and cover with component tests.
- [Risk] Refactor of `feedback-sheet.vue` removes a visible "Close" text button; users accustomed to it may briefly look for it → Mitigation: the new icon close button sits in a consistent, prominent header position; tap-outside-to-close offers an additional path.
- [Risk] Wrapping all sheets may subtly shift layout (height, padding) → Mitigation: visual review of each sheet after refactor; component tests assert the close button is present and emits.
- [Trade-off] Introducing a shared component now (previously deferred) is justified by the explicit consistency requirement and avoids re-touching all three sheets later.

## Migration Plan

No data or API migration. Ship behind no flag; purely additive UX.
