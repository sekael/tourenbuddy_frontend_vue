# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/320-primary-contact-method-switch` from latest `main` (`git checkout -b feat/320-primary-contact-method-switch main`); verify with `git branch --show-current`

## 2. Detail view

- [x] 2.1 Wrap phone rows (+ inline remove confirm) in a `<TransitionGroup>` with a slow eased move transition, disabled under `prefers-reduced-motion`; verify by promoting a phone in the running app
- [x] 2.2 Highlight the primary phone row when the contact has >1 phone; verify with a component test
- [x] 2.3 Render the primary star as inert `<span>` in edit mode; update/add component tests in `contact-detail-view.test.ts` and verify `npm run test` passes

## 3. Finalize

- [x] 3.1 Run `npx eslint --fix` on touched files, `npx eslint`, `npm run type-check`, `npm run test`; all pass
- [ ] 3.2 Prompt user to commit with a ready-to-copy conventional commit message
- [ ] 3.3 Prompt user to push and open a PR

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
