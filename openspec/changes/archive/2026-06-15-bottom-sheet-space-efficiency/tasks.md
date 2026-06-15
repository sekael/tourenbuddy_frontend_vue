## 1. Git Setup

- [x] 1.1 Create branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/bottom-sheet-space-efficiency`

> **Pivot (superseded keyboard approach).** Resizing the sheet around the keyboard (first `S − K`, then full-page `H − K` via a `visualViewport` inset) was buggy and noisy on-device — dragging moved the map, the keyboard flickered and left gaps. Replaced with: on mobile, data entry leaves the sheet for a full-screen page. Sections 2–5 below record the final shipped approach.

## 2. Full-screen page primitive

- [x] 2.1 Add `core/components/full-screen-page.vue`: opaque `position: fixed; inset: 0` surface, fixed top app bar (cancel control + `page-action` slot for Save), scrolling body; no drag/snap; covers the map. `Teleport to="body"` so a transformed sheet-container ancestor never becomes the page's containing block (was leaving an intermittent map sliver mid-transition)
- [x] 2.2 Style a shared `page-save-btn` (via `:slotted`) so consumers' top-bar Save buttons are consistent
- [x] 2.3 In `adaptive-overlay.vue`, add a `page` prop: mobile + `page` → `full-screen-page`, mobile → bottom sheet, desktop → dialog/drawer; forward all named slots through to whichever renders

## 3. Remove the keyboard machinery

- [x] 3.1 Delete `core/composables/use-keyboard-inset.ts` and its test
- [x] 3.2 In `bottom-sheet.vue`, strip the `inset`/`keyboardOpen`/`--keyboard-inset` publish, the `--fullscreen` class + CSS, and the refit/​drag guards; collapse `currentHeight` to `restingHeight`
- [x] 3.3 In `map-page.vue`, revert `.sheet-container` to `bottom: 0`
- [x] 3.4 Remove the keyboard-aware describe block from `bottom-sheet.test.ts`

## 4. Consumer wiring (data entry → page on mobile)

- [x] 4.1 `tour-form.vue` / `contact-form.vue`: add `formId` + `embedded` (hide the in-form action row); `tour-form` guards submit on `isUploadingGpx` and exposes `cancel()` for cleanup
- [x] 4.2 `tour-info-sheet.vue`: add `full-screen-page` as a third `:is` target for `!isDesktop && mode === 'edit' && !isPicking`; top-bar Save submits `tour-edit-form`; top-bar cancel runs the form's cleanup
- [x] 4.3 `tour-creation-dialog.vue`: `:page="!isPicking"`; top-bar Save submits `tour-create-form`; falls back to the collapsed sheet while picking
- [x] 4.4 `user-profile-sheet.vue`: `:page="isEditing"`; top-bar Save submits `profile-edit-form`; cancel returns to view
- [x] 4.5 `contacts-list-sheet.vue` (the live contact surface; `contact-creation-dialog.vue` is dead code): `:page` for the add form **and** a contact open in edit mode; import-results stays a sheet. Add-form Save submits `contact-add-form`; edit Save calls the detail view's `saveAll()`. Lift `contact-detail-view` `mode` to the parent via `defineModel` (survives the sheet→page remount) and add its `embedded` prop + `saveAll`/`cancelEdit`/`isSaving` expose
- [x] 4.6 Decision: leave `phone-verification-dialog` (OTP) and contact search as bottom sheets — not over the interactive map, paging is disproportionate (flag for the user)

## 5. Tests

- [x] 5.1 `bottom-sheet.test.ts`: keyboard tests removed; view-mode snap/drag/fit tests still pass
- [x] 5.2 `npm run test` — all pass (type-check + eslint clean)

## 6. Compact space usage (independent commit/PR)

- [x] 6.1 In `bottom-sheet.vue`, reduce content horizontal padding from `spacing-xl` toward `spacing-md`; tighten header `padding-bottom` and footer padding — trim **padding/margins/gaps** only (starting values, tuned on-device)
- [x] 6.2 Keep dividers/borders and a perceptible `gap` between groups; keep visible size == hit area (no invisible hit extensions) — verify nothing reads as cramped
- [x] 6.3 Audit heavy-button consumers (`tour-info-sheet` action row, creation/profile forms) for places that add their own padding or assume the old metrics; fix alignment (`tour-info-sheet .save-error` xl→md)

## 7. Verify on real viewport

- [x] 7.1 Push branch, open PR, wait for preview deploy
- [x] 7.2 On a real **iOS** phone/PWA: enter tour edit / creation / profile edit — surface becomes a full-screen page (no map behind), Save in the top bar stays above the keyboard, content scrolls, no drag/flicker
- [x] 7.3 On a real **Android** phone/PWA: repeat — same behavior
- [x] 7.4 Confirm a location pick mid-edit collapses to the sheet (map visible) and returns to the page after
- [x] 7.5 Confirm save/cancel returns to the bottom sheet with the map visible again
- [x] 7.6 Density check: confirm more content is visible, controls are still easily tappable, and nothing reads as cramped

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` and review the diff size (editor format-on-save fights antfu style)
- [x] 8.2 `npm run type-check`
- [x] 8.3 Prompt the user to commit — keep the two concerns in **separate commits**: `feat(ui): expand bottom sheet to full screen when keyboard opens` and `style(ui): trim bottom sheet chrome for denser content`
- [x] 8.4 Prompt the user to push and open the PR; do not commit on their behalf
- [x] 8.5 After merge, prompt the user to archive this change with the `openspec-archive` skill
