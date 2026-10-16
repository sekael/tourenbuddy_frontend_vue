# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/fit-selected-tour` from latest `main` (`git fetch origin && git checkout main && git pull && git checkout -b feat/fit-selected-tour`); verify with `git branch --show-current`

## 2. Framing

- [x] 2.1 Give `frameBounds` in `frame-tour.ts` an options object `{ fallbackCenter?, maxZoom? }` (max zoom default `TOUR_ZOOM`, no-room fallback no closer than `TOUR_ZOOM`) and export `ROUTE_ZOOM = 15`; verify with a unit test in `test/features/map/presentation/composables/frame-tour.test.ts`
- [x] 2.2 In the `map-page.vue` trail framing watcher, always frame with `ROUTE_ZOOM` (skip `isBoundsVisible`) when a route is chosen from the list (selected and more than one candidate, read after the settle waits); verify with page tests that a choice flies even when visible while a single visible lookup hit and going back to a visible list do not

## 3. Finalize

- [x] 3.1 Run `npx eslint --fix` on touched files, `npx eslint`, `npm run type-check`, `npm run test`; all pass
- [ ] 3.2 Prompt user to commit with a ready-to-copy conventional commit message
- [ ] 3.3 Prompt user to push and open a PR

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
