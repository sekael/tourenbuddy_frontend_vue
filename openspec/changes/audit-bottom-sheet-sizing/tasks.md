## 1. Git Setup

- [x] 1.1 Create branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/203-bottom-sheet-sizing-audit`

## 2. Wrapper default (fitContent)

- [x] 2.1 Add `fitContent?: boolean` to `adaptive-overlay.vue` via `withDefaults(defineProps<{...}>(), { fitContent: true })`
- [x] 2.2 Forward `:fit-content="props.fitContent"` to the mobile `<BottomSheet>` arm only (leave the `DialogWindow` arm untouched)

## 3. Set fitContent on the direct consumers

- [x] 3.1 `contact-action-menu.vue` — add `fit-content` to its direct `<BottomSheet>`
- [x] 3.2 `contact-creation-dialog.vue` — add `fit-content` to its direct `<BottomSheet>`
- [x] 3.3 Confirm `link-edit-warning-dialog.vue` already sets `fit-content` (no change)

## 4. Confirm snap sheets (audit, no code change)

- [x] 4.1 Verify `tour-list-sheet` and `tour-info-sheet` keep the snap default (no `fitContent` prop)
- [ ] 4.2 Spot-check `tour-info-sheet`: snap + collapsed-peek still reveals the map behind, edit-mode `TourForm` scrolls within the content region

## 5. Close-control audit

- [x] 5.1 Confirm the `BottomSheet` close button stays pinned in the header (outside `.content`) for every fit-content sheet, including when content overflows at 60vh
- [x] 5.2 Confirm no consumer hides/overrides the close button or relies solely on backdrop-tap to dismiss

## 6. Tests

- [x] 6.1 Assert `adaptive-overlay` forwards `fitContent: true` by default to its mobile `BottomSheet` arm, respects `:fit-content="false"`, and does not pass it to the desktop `DialogWindow` arm
- [x] 6.2 Assert the `BottomSheet` close button renders in the header when not `collapsed`
- [x] 6.3 `npm run test` — all pass (1012/1012)

## 7. Verify on real viewport

- [ ] 7.1 Push branch, open PR, wait for preview deploy
- [ ] 7.2 On a real phone / installed PWA, open each fit-content sheet — content fully visible, close button reachable, no drag-up needed
- [ ] 7.3 Open the form sheets (contact-creation, tour-creation, user-profile) with the keyboard up — no refit thrash; flip any offender to `:fit-content="false"`
- [ ] 7.4 Confirm `tour-info` still exposes the map when dragged/collapsed

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` and review the diff size (editor format-on-save fights antfu style)
- [x] 8.2 `npm run type-check`
- [ ] 8.3 Prompt the user to commit with a ready-to-copy conventional commit message (e.g. `feat(ui): default mobile sheets to fit-content, keep tour sheets snap (#203)`)
- [ ] 8.4 Prompt the user to push and open the PR; do not commit on their behalf
- [ ] 8.5 After merge, prompt the user to archive this change with the `openspec-archive` skill
