# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `chore/split-long-spec-requirements` from latest `main` (`git checkout -b chore/split-long-spec-requirements main`); verify with `git branch --show-current`

## 2. Delta specs

- [x] 2.1 Write REMOVED + ADDED deltas for the eight requirements in `auth`, `contact-device-import`, `map-integration`, `notifications`, `onboarding-tour`, `shared-tour-notifications`; verify every ADDED description is at most 500 characters and every original scenario is used exactly once
- [x] 2.2 Validate the change; verify `openspec validate split-long-spec-requirements --strict` passes
- [x] 2.3 Dry-run the archive into a copy of `openspec/` and run `verify-split.py` against it; verify 6/6 specs OK

## 3. Archive

- [x] 3.1 Archive with `openspec archive split-long-spec-requirements -y`; verify it reports `+ 44, - 8`
- [x] 3.2 Run `python3 openspec/changes/archive/<date>-split-long-spec-requirements/verify-split.py main`; verify 6/6 specs OK
- [x] 3.3 Validate the six specs with `openspec validate <spec> --type spec`; verify each is valid and none still warns about the eight split requirements

## 4. Finalize

- [x] 4.1 Run `npx eslint`; verify zero warnings (`openspec/**` is eslint-ignored, so this only confirms nothing else changed)
- [ ] 4.2 Prompt user to commit with a ready-to-copy conventional commit message
- [ ] 4.3 Prompt user to push and open a PR

## Workflow follow-up

- Fix the stale `map-integration` content listed in proposal.md (Out of scope) in a separate change — done in `fix-stale-speed-dial-specs`.
