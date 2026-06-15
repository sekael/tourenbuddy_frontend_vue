## Why

Bottom sheets have limited screen real estate, and that space must be used as effectively as possible to show relevant information. Two problems waste it today:

1. **Keyboard handling.** When the on-screen keyboard opens on mobile/PWA, the layout viewport does not shrink on iOS (and Android's default `interactive-widget=resizes-visual` behaves the same), so the `position: fixed; bottom: 0` `.sheet-container` ends up behind the keyboard. The browser then auto-scrolls the focused input into view, shoving the whole fixed layer — sheet *and* the map above it — up and out of view. Any bottom sheet with a text input (tour-info edit, contact/tour creation, profile, OTP) is affected.
2. **Wasted chrome.** Non-content chrome eats the limited space: the content's horizontal padding is `spacing-xl` (24px × 2 = 48px, ~13% of a 360px screen), plus generous header/footer padding and the gaps reserved around the drag handle and the edit/delete and cancel/save action buttons. This pushes relevant information out of view and forces extra scrolling.

We want the sheet's top anchored when the keyboard opens (the map above stays put) and the sheet to shrink from the bottom, **and** the sheet's non-content chrome trimmed so the maximum area goes to information — without sacrificing tap-target size or visual separation.

## What Changes

### Keyboard-aware sizing

- Add `core/composables/use-keyboard-inset.ts`: a **pure** composable owning `visualViewport` `resize` **and `scroll`** listeners, exposing a reactive `inset` ref equal to `K = max(0, window.innerHeight − (visualViewport.height + visualViewport.offsetTop))`. No DOM side effects.
- `bottom-sheet.vue` (the owner; no refcount — single active overlay is guaranteed) publishes `--keyboard-inset` on `:root` via `watch(inset)` and resets it to `0` on unmount. `.sheet-container` consumes `bottom: var(--keyboard-inset, 0px)` to lift above the keyboard.
- `bottom-sheet.vue` routes snap/fit heights through a reactive `restingHeight` base (`S`) and derives `currentHeight` from `(restingHeight, inset, H)`. With `H = innerHeight`, `K = inset`:
  - `K = 0` → `height = S` (restore, no keyboard)
  - `0 < K ≤ S` → `height = S − K` (sheet shrinks; the map keeps its top region)
  - `K > S` → `height = H − K` (small devices: sheet expands to the top, map sacrificed)
- While `inset > 0` the drag handle is inert (extend the existing `collapsed` guard) — size is keyboard-driven while typing.
- Behavior lives at the bottom-sheet **primitive**, so every input sheet benefits, in both snap and fit-content modes.
- **Decision (documented):** do **not** add `interactive-widget=resizes-content` to the viewport meta — keep `resizes-visual` on both platforms so `visualViewport` is the single, uniform mechanism.

### Compact space usage

- Trim the `bottom-sheet.vue` non-content chrome — **padding, margins, gaps** — so more of the sheet shows information: reduce content horizontal padding (from `spacing-xl`), tighten header and footer padding.
- **Soft requirement, no hardcoded floor:** UI/UX density is judged per control by visual inspection — controls stay comfortably usable, with **visible size == hit area** (no invisible hit extensions), and grouping separation (dividers/borders/`gap`) stays perceptible. We do not mandate fixed min sizes or assert sizes in a test.
- Audit the sheet consumers with the heaviest button bars (notably `tour-info-sheet` action buttons and the creation/profile forms) so trimming the primitive doesn't leave a consumer cramped or misaligned.

This density work is **mechanically independent** of the keyboard work and SHALL ship as its own commit (and may be split into its own PR) for reviewability.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bottom-sheet`: add a requirement that the sheet shrinks above the on-screen keyboard (top anchored, content scrolls, small-device fallback, drag inert while open); add a requirement that the sheet uses space efficiently — compact padding/margins/gaps while keeping controls comfortably usable (visible size == hit area) and grouping separation visible.

## Impact

- **New file:** `core/composables/use-keyboard-inset.ts` (+ unit test).
- **Changed:** `core/components/bottom-sheet.vue` (keyboard height math + compact spacing), `features/map/presentation/pages/map-page.vue` (`.sheet-container` CSS var). Possibly minor per-consumer spacing fixes (e.g. `tour-info-sheet`) surfaced by the audit.
- **Unchanged:** the map already resizes its canvas on `visualViewport.resize` (`tourenbuddy-map.vue`) and recomputes its interactive inset from `sheetContainerRef.offsetHeight` (`map-page.vue`) — both keep working. Deduping the map's listener onto the new composable is noted as a future cleanup, not part of this change.
- **No DB / API / dependency changes.** Pure presentation.
- **Verification:** real iOS *and* Android mobile/PWA via the PR preview deploy — keyboard behavior and visual density cannot be asserted in happy-dom beyond the composable's pure math; the density check is a visual sign-off that controls stay tappable and content is more visible.
