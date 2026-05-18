## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b fix/149-point-row-button-wrap`

## 2. Fix tour-form point rows

- [x] 2.1 In `src/features/tours/presentation/components/tour-form.vue`, update `.point-row` CSS: add `flex-wrap: wrap` and `row-gap: var(--spacing-xs)` (or matching token) so action buttons wrap onto a new line when they exceed the section width
- [x] 2.2 Verify end-point section in dev (≤360 px viewport): "Add End Point" + "Round Trip" / "Rundtour" wrap inside the bounded `.point-section` background for both `de-CH` and `en` locales
- [x] 2.3 Verify goal and start point rows remain visually unchanged on wide viewports and wrap gracefully on narrow ones

## 3. Audit other button rows

- [x] 3.1 At 320 px viewport, manually inspect button rows in: `contact-action-menu.vue`, `contacts-list-sheet.vue`, `contact-creation-dialog.vue`, `friend-requests-sheet.vue`, `map-base-map-panel.vue`, `speed-dial-item.vue`, `tour-list-row.vue`, `tour-info-sheet.vue`
- [x] 3.2 For each confirmed overflow found, apply minimal `flex-wrap: wrap` + `row-gap` fix to the offending container only (no restyling). Do not change containers that already render correctly
- [x] 3.3 Document audit result (passing components + any fixed ones) in PR description

## 4. Tests

- [x] 4.1 No new unit tests — visual/CSS-only change. If a Vitest component test asserts a specific layout/class on `.point-row`, update only if it breaks
- [x] 4.2 `npm run test` — all pass
- [x] 4.3 `npm run type-check` — clean

## 5. Finalize

- [x] 5.1 `npx eslint . --fix` — zero warnings
- [ ] 5.2 Prompt user to commit with conventional commit message: `fix(tours): wrap point-row action buttons to stay within section bounds (#149)`
- [ ] 5.3 Prompt user to push branch and open PR linking issue #149; include before/after screenshots on iPhone-sized viewport and the audit result from 3.3
