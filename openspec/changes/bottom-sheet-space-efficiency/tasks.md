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

## 4. Sheet height math

- [x] 4.1 In `bottom-sheet.vue`, consume the `inset` ref; route snap/fit heights through a reactive `restingHeight` base (`S`) instead of writing `currentHeight` directly
- [x] 4.2 Derive `currentHeight` from `(restingHeight, inset, H)` via the branch: `K=0 → S`; `0<K≤S → S−K`; `K>S → H−K`
- [x] 4.3 Gate the drag handle while `inset > 0`: extend the `onDragStart` `collapsed` early-return to `collapsed || inset > 0`
- [x] 4.4 Confirm restore on keyboard close (inset → 0) returns to `S` and the `:root` offset → 0

## 5. Tests

- [x] 5.1 Unit-test `use-keyboard-inset` with a mocked `visualViewport`: inset math, iOS `offsetTop` term, `max(0,…)` clamp, `resize`+`scroll` updates, open/close, cleanup
- [x] 5.2 Component test for the height branch in `bottom-sheet.vue` (drive a mocked inset): `S−K` when `K≤S`, `H−K` when `K>S`, restore at `K=0`, and drag inert while `inset > 0`
- [x] 5.3 `npm run test` — all pass

## 6. Compact space usage (independent commit/PR)

- [x] 6.1 In `bottom-sheet.vue`, reduce content horizontal padding from `spacing-xl` toward `spacing-md`; tighten header `padding-bottom` and footer padding — trim **padding/margins/gaps** only (starting values, tuned on-device)
- [x] 6.2 Keep dividers/borders and a perceptible `gap` between groups; keep visible size == hit area (no invisible hit extensions) — verify nothing reads as cramped
- [x] 6.3 Audit heavy-button consumers (`tour-info-sheet` action row, creation/profile forms) for places that add their own padding or assume the old metrics; fix alignment (`tour-info-sheet .save-error` xl→md)

## 7. Verify on real viewport

- [x] 7.1 Push branch, open PR, wait for preview deploy
- [x] 7.2 On a real **iOS** phone/PWA: open tour-info edit, focus an input — map stays at its top region, sheet shrinks above the keyboard, content scrolls, close button reachable
- [x] 7.3 On a real **Android** phone/PWA: repeat — confirm the same behavior via the visualViewport path (no `resizes-content` reliance)
- [x] 7.4 Small-device check: confirm the `K > S` fallback (sheet expands to top) behaves sanely
- [x] 7.5 Confirm keyboard close restores the 40% map / sheet layout, and the map canvas resizes correctly
- [x] 7.6 Density check: confirm more content is visible, controls are still easily tappable, and nothing reads as cramped

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` and review the diff size (editor format-on-save fights antfu style)
- [x] 8.2 `npm run type-check`
- [x] 8.3 Prompt the user to commit — keep the two concerns in **separate commits**: `feat(ui): shrink bottom sheet above the on-screen keyboard` and `style(ui): trim bottom sheet chrome for denser content`
- [x] 8.4 Prompt the user to push and open the PR; do not commit on their behalf
- [x] 8.5 After merge, prompt the user to archive this change with the `openspec-archive` skill
