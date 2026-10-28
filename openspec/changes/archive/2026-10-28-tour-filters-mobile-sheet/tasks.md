# Tasks

## 1. Grade model and filter state

- [x] 1.1 Replace `GradeRange`/`tapGradeRange`/`gradeInRanges` with `gradeSelected` in `grade.ts`; verify in `grade.test.ts` (modifier, alpine S vs S2, free text, bike-and-hike on any part)
- [x] 1.2 `TourFilters.grades: Set<string>`; partner match on contact ids only; verify in `use-tour-filters.test.ts`

## 2. Filter panel

- [x] 2.1 Friends: recorded-by only (`use-friend-owner-options.ts`), group held at one chip row until names settle; My Tours: partner chips; verify in `tour-filters-panel.test.ts`
- [x] 2.2 Additive grade chips in a 7-column grid; drop the pinned summary row and the grade hint; 44px targets
- [x] 2.3 Locale keys `tours.filters.resetBtn`, `tours.filters.showResultsBtn`; drop `matchCount`, `gradeHint`; verify `npm run check:locales`

## 3. List sheet and bottom sheet

- [x] 3.1 Panel in place of the rows, footer with Reset + "Show N tours", Escape on the sheet root, no outside dismissal; `resizable` off while filtering; verify in `tour-list-sheet.test.ts`
- [x] 3.2 Held `BottomSheet` drags / snap keys reach full snap heights; verify in `bottom-sheet.test.ts`

## 4. Contact detail

- [x] 4.1 "Show tours" icon `route`

## 5. Verification

- [x] 5.1 `npx eslint .`, `npm run type-check`, `npm run test`
- [x] 5.2 Independent persona review (phone + desktop) passes all goals in `.review/goals.md`
