## 1. Git Setup

- [x] 1.1 Create branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/bottom-sheet-space-efficiency`

## 2. Detection composable (pure)

- [x] 2.1 Add `core/composables/use-keyboard-inset.ts`: own `visualViewport` `resize` **and `scroll`** listeners, expose a reactive `inset` ref = `K = max(0, innerHeight − (visualViewport.height + visualViewport.offsetTop))`. No DOM writes
- [x] 2.2 Clean up both listeners on unmount
- [x] 2.3 Guard `visualViewport` being undefined (older/unsupported) — inset stays `0`

## 3. Owner publishes the var + container offset

- [x] 3.1 In `bottom-sheet.vue`, `watch(inset)` and write `--keyboard-inset: ${inset}px` on `document.documentElement`; reset to `0px` on unmount
- [x] 3.2 In `map-page.vue`, apply `bottom: var(--keyboard-inset, 0px)` to `.sheet-container`
- [x] 3.3 Verify the map's interactive inset (`sheetContainerRef.offsetHeight`) still recomputes as the sheet height changes

## 4. Sheet height math (full-page above keyboard)

- [x] 4.1 In `bottom-sheet.vue`, consume the `inset` ref; route snap/fit/drag heights through a reactive `restingHeight` base (`S`) instead of writing the applied height directly
- [x] 4.2 Derive `currentHeight` as a `computed` of `(restingHeight, inset, H)`: `K=0 → S`; `K>0 → H−K` (full page above the keyboard, covering the map)
- [x] 4.3 Add a `bottom-sheet--fullscreen` class (bound to `inset > 0`) that drops the `max-height: 60vh` cap, top corner radius, side/top borders, and hides the drag handle — so no gaps show over the covered map
- [x] 4.4 Gate the drag handle while `inset > 0`: extend the `onDragStart` `collapsed` early-return to `collapsed || inset > 0`; guard the refit paths (`openAtNaturalHeight`, `onWindowResize`) to skip while the keyboard is open
- [x] 4.5 Confirm restore on keyboard close (inset → 0) returns to `S`, the `:root` offset → 0, and the map is revealed

## 5. Tests

- [x] 5.1 Unit-test `use-keyboard-inset` with a mocked `visualViewport`: inset math, iOS `offsetTop` term, `max(0,…)` clamp, `resize`+`scroll` updates, open/close, cleanup
- [x] 5.2 Component test for the height branch in `bottom-sheet.vue` (drive a mocked inset): full-page `H−K` whenever `K>0` (with `--fullscreen` class), restore at `K=0`, and drag inert while `inset > 0`
- [x] 5.3 `npm run test` — all pass

## 6. Compact space usage (independent commit/PR)

- [x] 6.1 In `bottom-sheet.vue`, reduce content horizontal padding from `spacing-xl` toward `spacing-md`; tighten header `padding-bottom` and footer padding — trim **padding/margins/gaps** only (starting values, tuned on-device)
- [x] 6.2 Keep dividers/borders and a perceptible `gap` between groups; keep visible size == hit area (no invisible hit extensions) — verify nothing reads as cramped
- [x] 6.3 Audit heavy-button consumers (`tour-info-sheet` action row, creation/profile forms) for places that add their own padding or assume the old metrics; fix alignment (`tour-info-sheet .save-error` xl→md)

## 7. Verify on real viewport

- [x] 7.1 Push branch, open PR, wait for preview deploy
- [x] 7.2 On a real **iOS** phone/PWA: open tour-info edit, focus an input — sheet expands to a full page above the keyboard (no gaps over the map), content scrolls, close button reachable
- [x] 7.3 On a real **Android** phone/PWA: repeat — confirm the same behavior via the visualViewport path (no `resizes-content` reliance)
- [x] 7.4 Small-device check: confirm the full-page sheet fills exactly to the keyboard top with no gap and the content scrolls
- [x] 7.5 Confirm keyboard close restores the 40% map / sheet layout, and the map canvas resizes correctly
- [x] 7.6 Density check: confirm more content is visible, controls are still easily tappable, and nothing reads as cramped

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` and review the diff size (editor format-on-save fights antfu style)
- [x] 8.2 `npm run type-check`
- [x] 8.3 Prompt the user to commit — keep the two concerns in **separate commits**: `feat(ui): expand bottom sheet to full screen when keyboard opens` and `style(ui): trim bottom sheet chrome for denser content`
- [x] 8.4 Prompt the user to push and open the PR; do not commit on their behalf
- [x] 8.5 After merge, prompt the user to archive this change with the `openspec-archive` skill
