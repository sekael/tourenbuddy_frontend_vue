## Context

Mobile bottom sheets sit in a `.sheet-container` that is `position: fixed; bottom: 0` (`map-page.vue:770`), stacked over a full-screen MapLibre map. `bottom-sheet.vue` computes its own height (`currentHeight`) from snap points (`window.innerHeight * 0.4/0.6`) or, in fit-content mode, `min(content, 60vh)`.

The on-screen keyboard breaks this: on iOS the layout viewport (`window.innerHeight`) does **not** shrink, and Android's default `interactive-widget` is `resizes-visual` — same effect. The keyboard overlays the fixed container and the browser auto-scrolls the focused input into view, dragging the whole fixed layer (sheet + map) upward. The **visual** viewport, however, does shrink, and `tourenbuddy-map.vue:123` already listens to `visualViewport.resize` to call `map.resize()`.

## Goals / Non-Goals

**Goals:**
- Sheet expands to a full page above the keyboard (covers the map), giving the whole screen to the edit form; content scrolls; the map returns on close.
- One uniform mechanism across iOS and Android.
- Works for every input sheet (snap and fit-content), at the primitive level.
- Keyboard detection isolated and unit-testable.

**Non-Goals:**
- No change to snap points, drag, or fit-content sizing themselves — only a keyboard-driven adjustment on top.
- No desktop changes (no keyboard-over-sheet problem there).
- Not deduping the map's existing `visualViewport` listener in this change (future cleanup).
- The density pass tunes spacing only — no restructuring of sheet layout or consumer markup beyond what's needed to keep things aligned.

## Decisions

**1. Detection lives in a PURE `use-keyboard-inset` composable.**
It owns `visualViewport` `resize` **and `scroll`** listeners and exposes a reactive `inset` ref equal to `K = max(0, window.innerHeight − (visualViewport.height + visualViewport.offsetTop))`. The `offsetTop` term matters on iOS (the visual viewport can scroll within the layout viewport, firing `scroll` not `resize`); the `max(0, …)` clamp prevents a sub-pixel/transition negative from pushing the sheet off-screen. The composable does **not** touch the DOM — no `:root` write.
- Rationale: a pure "reactive keyboard height in px" is trivially unit-testable (mock `visualViewport`, assert the math, open/close, cleanup) and free of hidden global side effects. The inset is a *viewport* property, not a sheet property, so it doesn't belong inside `bottom-sheet.vue`'s already-dense logic.
- Owner: `bottom-sheet.vue` instantiates it. **No refcount** — `responsive-overlay` guarantees a single active overlay, so at most one instance is live; even a transient double-mount computes the same global `K` (idempotent). The map keeps its own `visualViewport` listener for `map.resize()` (future dedupe, not now).
- Alternative considered: composable writes `--keyboard-inset` itself. Rejected — mutating `document.documentElement` is a hidden side effect and harder to test; the var-write is a presentation concern that belongs with the lifecycle owner.

**2. Application split: owner publishes the CSS var; container consumes it; sheet does the height math.**
`bottom-sheet.vue` (the owner) `watch`es `inset` and writes `--keyboard-inset` on `:root`, **resetting it to `0` on unmount** (so closing a sheet while the keyboard is up doesn't leave a stale offset). `.sheet-container` consumes `bottom: var(--keyboard-inset, 0px)` to lift above the keyboard.
- Rationale: the sheet is `position: relative` *inside* the fixed container, so a child can't style its parent via scoped CSS — it pushes the value up through a `:root` var. The var is unavoidable; *who writes it* is the owner, colocated with mount/unmount so the reset is guaranteed. Alternative (`translateY(-K)` inside the sheet) fights the relative-inside-fixed layout and risks clipping at the container edge.

**3. Full-page height via a reactive `restingHeight` base.**
The snap/fit/drag logic writes a `restingHeight` ref (`S`) (snap → `snapHeightPx(lastSnap)`, fit → measured fit height, drag → the clamped gesture height) instead of the applied height directly. The applied `currentHeight` is a `computed` of `(restingHeight, inset, H)`:
- `K = 0` → `S`
- `K > 0` → `H − K` (full page above the keyboard; the container's bottom sits at `K`, so `H − K` reaches `y = 0` with no gap; the map is covered)
- Rationale: a reactive base + `computed` makes restore-on-close free — the branch yields `S` with no stored snapshot to go stale, and there's no imperative `watch` to keep in sync. The full-page branch collapses the old `S − K` / `H − K` split into a single case (an earlier on-device iteration shrank the sheet to `S − K` to keep the map visible, but it was buggy and noisy and left gaps; full-page replaces it).
- Drag can write `restingHeight` live because it's inert while the keyboard is open (Decision 4), so the `K > 0` branch never collides with a gesture.

**4. Gate the drag handle while the keyboard is open.**
While `inset > 0`, the drag handle is inert — `onDragStart` early-returns, exactly mirroring the existing `collapsed` guard (extend it to `collapsed || inset > 0`). While typing, the sheet is full-page and keyboard-driven; manual resize is meaningless. `restingHeight` is untouched, so closing the keyboard restores the prior snap.
- Alternatives considered: drag-to-dismiss-keyboard (adds an imperative `blur()` and a surprise). Rejected.

**4b. Drop gap-causing chrome in full-page mode.**
A `bottom-sheet--fullscreen` class (bound to `inset > 0`) removes the `max-height: 60vh` cap, top corner radius, and side/top borders, and hides the drag handle. Without this, the screenshot gaps persist regardless of height — the 60vh cap alone leaves a void with the map peeking through.

**5. Keep `interactive-widget` at the default (`resizes-visual`); do not add `resizes-content`.**
With `resizes-content`, Android would shrink the layout viewport, making `K ≈ 0` and routing Android through a *different* path than iOS. Keeping `resizes-visual` everywhere means `visualViewport` is the single mechanism on both platforms. Trade-off: we rely entirely on the JS path rather than letting Android's browser do it natively — accepted for uniformity and testability.

**6. Compact chrome as a soft, visual requirement (density pass).**
Trim non-content chrome in `bottom-sheet.vue` — **padding, margins, gaps** — so more area goes to information: reduce content horizontal padding from `spacing-xl` (24px) toward `spacing-md` (reclaims ~13% horizontal), tighten header `padding-bottom` and footer padding. These are *starting* values, tuned on-device.
- **Soft requirement, no hardcoded floor.** UI/UX density is judged per control by visual inspection, not a magic number. Controls must stay comfortably tappable, but each control's usable size is a design decision that may change; we do **not** mandate explicit min sizes or assert sizes in a test.
- **visible size == hit area.** No invisible hit extensions — a tap target that's bigger than what it looks like causes confusing behavior.
- **Separation stays perceptible.** Compact ≠ cramped; keep dividers/borders and a readable `gap` between groups.
- **Tune the primitive, audit consumers.** The chrome lives in `bottom-sheet.vue`; the per-consumer audit (e.g. `tour-info-sheet`'s action row) only catches places that add their own padding or assume the old metrics.
- **Independence:** touches no JS logic; ships as its own commit/PR; can land before or after the keyboard work.

## Risks / Trade-offs

- **Two `visualViewport` listeners** (map + composable) fire on the same event → both run cheap work; functionally fine. Mitigation: noted future dedupe of the map listener onto the composable.
- **iOS `offsetTop` / `scroll` drift** → handled by listening to `scroll` as well as `resize`, plus the `max(0, …)` clamp; covered by unit tests.
- **`map.resize()` timing** → the map already resizes on `visualViewport.resize`; the sheet expand and map canvas resize are driven by the same event, so they stay consistent (the map is covered while the keyboard is open, but resizes correctly underneath and is revealed on close).
- **Density is visual-only** → no automated guard; regressions are caught by on-device review, an accepted cost of treating UI/UX density as a soft requirement.
- **happy-dom has no real layout / `visualViewport`** → unit-test the composable's pure math with a mocked `visualViewport`; the visual result is verified on-device.

## Migration Plan

Pure presentation, no migration. Rollback = revert the composable + the two consumers; no data or schema touched.

## Open Questions

_None._
