## Context

Current state:

- `BottomSheet` (`src/core/components/bottom-sheet.vue`) only implements mobile styles (bottom-anchored, drag handle). No media-query branch despite `responsive-overlay` spec calling for a centered desktop dialog.
- `map-page.vue` wraps all overlays in `.sheet-container { position: absolute; bottom: 0; ... }`, forcing bottom positioning at any viewport.
- `SideDrawer` correctly switches between `BottomSheet` (<600px) and a right-edge drawer (≥600px).
- `TourCreationDialog` already renders as a centered dialog on desktop but lives outside the `activeOverlay` single-active policy (`showTourCreationDialog` is an independent `ref`).
- Single-overlay policy in `map-page.vue` governs feedback/profile/contacts/tour-info only.
- `useIsDesktop()` wraps `(min-width: 600px)` media query — the canonical breakpoint.

Result: desktop users see feedback, profile, contacts as bottom sheets — the stated bug.

## Goals / Non-Goals

**Goals:**

- Desktop (≥600px): feedback, user profile, contacts, add-location render as centered dialog windows.
- Mobile (<600px): behavior unchanged.
- At most one of {dialog window, tour-creation dialog, side drawer} visible on desktop at any time.
- At most one bottom sheet on mobile (unchanged invariant).
- Smooth enter/leave transitions; matches existing design tokens (radius-lg, shadow-lg, backdrop blur 2px).

**Non-Goals:**

- Redesigning feedback/profile/contacts content.
- Touching `phone-verification-dialog` / `contact-creation-dialog` (nested dialogs launched from within contacts/profile flows — kept as-is).
- E2E test coverage (no Playwright config yet).
- Desktop drag-to-resize or dialog stacking.

## Decisions

### 1. New `DialogWindow` primitive (NOT extend `BottomSheet`)

Add `src/core/components/dialog-window.vue`:

- Fullscreen fixed backdrop `rgba(15, 23, 42, 0.35)` + `backdrop-filter: blur(2px)`.
- Centered card: `max-width: 560px`, `border-radius: var(--radius-lg)` all sides, `max-height: 90dvh`, `box-shadow: var(--shadow-lg)`.
- Header (title + close button), scrollable content slot.
- Backdrop click closes; content click does not.
- Transition: fade-in + `scale(0.95)→1` (as responsive-overlay spec already specifies).
- Props mirror `BottomSheet`: `title?`, `ariaLabel?` + `close` emit + default slot.

**Alternative considered**: extend `BottomSheet` with a media-query branch (as current spec worded). Rejected — the two layouts share almost nothing (positioning, animation, drag handle, backdrop), a single SFC hides that complexity poorly. Two primitives + one adaptive wrapper is cleaner.

### 2. Adaptive wrapper: `AdaptiveOverlay`

Add `src/core/components/adaptive-overlay.vue`:

- `<BottomSheet>` if `!isDesktop`, `<DialogWindow>` if `isDesktop`.
- Same props/emits/slot as both primitives.
- Replace `BottomSheet` usage in `feedback-sheet.vue`, `user-profile-sheet.vue`, `contacts-list-sheet.vue` with `AdaptiveOverlay`.

### 3. `TourCreationDialog` uses `DialogWindow` on desktop, `BottomSheet` on mobile

Currently has its own bespoke `.dialog-backdrop` + `.dialog` styles that already resemble `DialogWindow` on desktop but bottom-dock on mobile. Swap internals for `AdaptiveOverlay` to unify styling and participate in single-overlay policy. Preserves current visual behavior.

### 4. Unified `activeOverlay` in `map-page.vue`

Extend `OverlayName` union from `'feedback' | 'profile' | 'contacts' | 'tour'` to also include `'tour-creation'`. Drive `showTourCreationDialog` from `activeOverlay === 'tour-creation'`. `openOverlay()` continues to close the previous overlay, which now also dismisses tour-creation when e.g. a marker is clicked.

On mobile, the same `activeOverlay` already enforces single-bottom-sheet — reuse.

Side drawer (tour info) already flows through `activeOverlay === 'tour'`, so the policy already covers it. No change needed beyond the union extension.

### 5. Container positioning

`.sheet-container` currently: `position: absolute; bottom: 0; left: 0; right: 0;`. On desktop this conflicts with dialog centering. Since `DialogWindow` and `SideDrawer` both use `position: fixed` internally, they don't need the container at all on desktop. Resolution: keep the container for mobile (its pointer-events:none trick matters there for FAB click-through) and let desktop components position themselves via `position: fixed`. Container gets `@media (min-width: 600px) { display: contents }` or we drop the wrapper for desktop branches. Pick `display: contents` — keeps template symmetric.

### 6. Transition

`<Transition name="sheet" mode="out-in">` in map-page.vue currently slides vertically. On desktop we want fade-scale. Options:
a) Let `DialogWindow`/`SideDrawer` own their own enter/leave animations (current `SideDrawer` already does via CSS keyframes) and make the outer `<Transition>` a no-op (or `name="overlay"` with viewport-dependent styles).
b) Two `<Transition>` blocks gated by `isDesktop`.

Pick (a): each component animates itself. Remove the outer `<Transition>` or neutralize it; `out-in` mode is still required to guarantee ordering, but with instant outer transitions the child animations drive visuals. Use `mode="out-in"` on a named transition whose CSS is a no-op, relying on child CSS keyframes/transitions.

### 7. Test strategy

- Unit tests for `DialogWindow` (render, close emit, backdrop click, a11y attrs).
- Update existing `BottomSheet` / adaptive tests to cover `AdaptiveOverlay` branching via `useMediaQuery` mock (happy-dom).
- Map-page integration test: opening tour-creation while feedback is open closes feedback; opening profile while tour-info drawer is open closes drawer.

## Risks / Trade-offs

- [Focus trap / ESC-to-close not currently implemented on any overlay] → Out of scope; flagged for follow-up.
- [`AdaptiveOverlay` adds an indirection layer for consumers] → Mitigated by identical API to `BottomSheet`; one-line swap in each consumer.
- [`TourCreationDialog` participating in `activeOverlay` changes reset semantics — closing it from another overlay click might drop unsaved form state] → Acceptable; mirrors how other overlays behave, matches user's explicit single-overlay requirement.
- [Outer `<Transition>` neutralized → brief flash if both old and new overlays mount simultaneously] → `mode="out-in"` preserved to serialize.
