# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/322-tour-search-filter-behavior` from latest `main`; verify with `git branch --show-current`

## 2. Sheet height hold

- [x] 2.1 Add optional `holdHeight` prop to `bottom-sheet.vue` (grow-only clamp in `refit()`, peek exempt, refit on release); add tests in `test/core/components/` and verify they pass
- [x] 2.2 Pass `hold-height` from `tour-list-sheet.vue` while search query or filters are active; verify with a component test

## 3. Reset on leaving the list

- [x] 3.1 Export `resetTourFilters()` from `use-tour-filters.ts` sharing clear logic with `clearAll`; unit test that both tabs reset and the active tab is kept
- [x] 3.2 Watch `activeOverlay` in `map-page.vue` and reset when it becomes neither `tours` nor `tour`; verify by test or headless walk

## 4. Finalize

- [x] 4.1 Run `npx eslint --fix` on touched files, `npx eslint`, `npm run type-check`, `npm run test`; all pass
- [x] 4.2 Prompt user to commit with a ready-to-copy conventional commit message
- [x] 4.3 Prompt user to push and open a PR

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
