# Tasks

## 1. Git Setup

- [x] 1.1 Work on `chore/split-long-spec-requirements` (same docs-only PR as the split; branched from latest `main`)

## 2. Delta specs

- [x] 2.1 Check the stale statements against the app (`use-map-overlay.ts`, `map-action-overlay.vue`, `map-page.vue`, `map-layers-panel.vue`, `layer-tile.vue`); verify every corrected statement matches the code
- [x] 2.2 Write the `map-integration` and `design-system` deltas; verify `openspec validate fix-stale-speed-dial-specs --strict` passes

## 3. Archive

- [x] 3.1 Archive with `openspec archive fix-stale-speed-dial-specs -y`; verify `map-integration` and `design-system` validate
- [x] 3.2 Verify no spec still mentions the style picker, `map-base-map-panel`, or a disabled trigger without the dismiss tap

## 4. Finalize

- [x] 4.1 Run `npx eslint`; verify zero warnings
- [ ] 4.2 Prompt user to commit with a ready-to-copy conventional commit message
- [ ] 4.3 Prompt user to push and open a PR
