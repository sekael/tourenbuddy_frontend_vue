# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/fit-selected-tour` from latest `main` (`git fetch origin && git checkout main && git pull && git checkout -b feat/fit-selected-tour`); verify with `git branch --show-current`

## 2. Framing

- [x] 2.1 Add optional `maxZoom` (default `TOUR_ZOOM`) to `frameBounds` and export `ROUTE_ZOOM = 15` in `frame-tour.ts`; unit test the cap is passed through
- [x] 2.2 In the `map-page.vue` trail framing watcher, always frame (skip `isBoundsVisible`) with `ROUTE_ZOOM` when a route is chosen from the list (same candidates, `selectedId` null → id); page test that a pick flies even when the route is visible and back-to-list does not

## 3. Finalize

- [x] 3.1 Run `npx eslint --fix` on touched files, `npx eslint`, `npm run type-check`, `npm run test`; all pass
- [ ] 3.2 Prompt user to commit with a ready-to-copy conventional commit message
- [ ] 3.3 Prompt user to push and open a PR

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
