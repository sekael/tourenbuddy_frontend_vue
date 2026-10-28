# Tasks

## 1. Git Setup

- [x] 1.1 Create `feat/351-362-tour-filters` from local `main` (container has no ssh for `git fetch`) and verify with `git branch --show-current`

## 2. Grade range model

- [x] 2.1 Add `GradeRange`, `tapGradeRange`, `gradeInRanges`, `gradeScaleOf` and the filter scale list to `src/features/tours/data/models/grade.ts`; verify edge cases (modifier, free text, multi-scale, restart, clear) in `test/features/tours/data/models/grade.test.ts`

## 3. Filter state and predicate

- [x] 3.1 Extend `TourFilters` with `gradeRanges` and `ownerIds`; grade + owner matching, Friends-tab partner matching by user id, badge count and clear in `use-tour-filters.ts`; verify in `use-tour-filters.test.ts` (Friends partner chip no longer empties the list, withheld roster never matches, grade counts once)
- [x] 3.2 Add `useListedTourIds()` (outing segments kept whole, `null` when nothing narrows) and `showFriendTours(userId)`; verify both in `use-tour-filters.test.ts`

## 4. Filter panel UI

- [x] 4.1 Grade group inline in the panel (a child component can't take the panel's scoped chip styles): one chip row per offered scale, range lit, `aria-pressed`; offered scales = in use on the tab's tours ∪ scales with a range
- [x] 4.2 Panel: recorded-by group (Friends only), tab-aware partner chips, grade group; people groups behind one settle gate; locale keys in `en.json` + `de-CH.json`; verify with `npm run check:locales` and a panel test for the Friends-tab chips
- [x] 4.3 List sheet: pass tab + source tours, wire new emits; clamp `.list-region` to the panel's measured height while open and hold the sheet height; verify with a list-sheet test and a headless walk on a long list

## 5. Map follows the list

- [x] 5.1 `TourenbuddyMap` prop for listed ids, applied before collision shadowing (pure `toursOnMap` in `map/domain`); map page passes `useListedTourIds()` only while the `tours` overlay is open; verify in `tours-on-map.test.ts` (unshadowing, non-partner stays unmarked) and `map-page.test.ts` (only while the list is open)

## 6. Contact → friend's tours

- [x] 6.1 "Show tours" in `contact-detail-view.vue` (view mode, linked friend, not blocked) → `contacts-list-sheet.vue` re-emit → map page opens the filtered list; locale keys; verify with a contact-detail test and the walk

## 7. Integration

- [x] 7.1 `npx eslint . --fix`, `npx eslint`, `npm run type-check`, `npm run test` all green
- [x] 7.2 Headless walk: grade range on My Tours thins the map, Friends recorded-by + partner chips, contact detail → friend's tours, long list panel scroll ends at its content; guided tour still walks (no moved targets)
- [x] 7.3 Independent reviewer pass (outdoor-athlete persona) until no open findings

## 8. Finalize

- [x] 8.1 Validate `openspec validate tour-list-grade-friend-filters --strict`
- [x] 8.2 Prompt the user to commit with a ready-to-copy conventional commit message
- [x] 8.3 Prompt the user to push and open the PR (body in `.git/PR_BODY.md`)

## Workflow follow-up

- Archive the change once review is done, then diff touched main specs' `validate --type spec --strict` errors against `main`.
