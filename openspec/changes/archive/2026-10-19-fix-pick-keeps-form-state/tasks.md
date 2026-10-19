# Tasks

## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git checkout main && git pull && git checkout -b fix/337-start-point-keeps-draft` — verify `git branch --show-current`

## 2. Collapsible full-screen page

- [x] 2.1 Add a `collapsed` prop to `src/core/components/full-screen-page.vue`: bottom-anchored title-only bar styled like the collapsed bottom sheet, content `v-show` hidden + `inert`/`aria-hidden`, close control and `page-action` hidden — verify with tests in `test/core/components/adaptive-overlay.test.ts` (slot stays mounted with its state across collapse/expand; no close/action while collapsed)
- [x] 2.2 Forward `collapsed` from `src/core/components/adaptive-overlay.vue` to `FullScreenPage` — verify with a test in `test/core/components/adaptive-overlay.test.ts` that a stateful slot child is mounted once across a page-mode collapse/expand on mobile

## 3. Tour form hosts keep page mode during a pick

- [x] 3.1 `tour-creation-dialog.vue`: page mode no longer depends on `isPicking` (`collapsed` handles the pick) — verify with `test/features/tours/presentation/components/tour-creation-dialog.spec.ts` (`page` stays true while picking)
- [x] 3.2 `tour-info-sheet.vue`: `editAsPage` no longer depends on `isPicking`, so the `:is` surface doesn't swap during a pick — verify the existing tour-info-sheet tests still pass and the page receives `collapsed` while picking
- [x] 3.3 Manual check on a <600px viewport: create a tour, set partners + activity type, pick a start point → both kept; same for edit with a notes change and an end-point pick; picker Cancel/Continue sit above the collapsed bar

## 4. Finalize

- [x] 4.1 Run `npx eslint . --fix`, `npx eslint` (zero warnings), `npm run type-check`, `npm run test` — all pass
- [x] 4.2 Prompt the user to commit with a ready-to-copy conventional commit message
- [x] 4.3 Prompt the user to push and open a PR referencing #337

## Workflow follow-up

- Archive the change with `openspec-archive` after the PR is merged.
