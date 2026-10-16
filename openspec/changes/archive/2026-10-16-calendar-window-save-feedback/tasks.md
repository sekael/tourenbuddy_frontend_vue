# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/321-calendar-sync-save-feedback` from latest `main`; verify with `git branch --show-current`

## 2. Window form

- [x] 2.1 Add `dirty` computed + local `saving` / `saved` state to `calendar-sync-settings.vue`; button disabled unless dirty, label Save / Saving… / ✓ Saved (success style, `role="status"`)
- [x] 2.2 Add `calendar.sync.savingWindow` / `calendar.sync.savedWindow` to `en.json` and `de-CH.json`; verify `npm run check:locales`
- [x] 2.3 Add `test/features/calendar/presentation/components/calendar-sync-settings.test.ts` covering clean/dirty/revert/failed-save/saved-then-edit; verify `npm run test`

## 3. Finalize

- [x] 3.1 Run `npx eslint --fix` on touched files, `npx eslint`, `npm run type-check`, `npm run test`; all pass
- [x] 3.2 Prompt user to commit with a ready-to-copy conventional commit message
- [x] 3.3 Prompt user to push and open a PR

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
