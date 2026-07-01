## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/146-unify-safe-area-tokens`

## 2. env() → var(--safe-*) sweep

- [x] 2.1 Confirm baseline: `grep -rn "env(safe-area-inset" src/` — record the ~15 hit files (excluding `src/app/theme/safe-area.css`)
- [x] 2.2 `src/core/components/`: migrate `pwa-install-banner.vue`, `update-prompt.vue`, `error-snackbar.vue`, `bottom-sheet.vue`, `full-screen-page.vue` — replace each inline `env(safe-area-inset-X)` / `env(safe-area-inset-X, 0px)` with `var(--safe-X)`, preserving any surrounding `calc(var(--spacing-*) + …)`
- [x] 2.3 `src/features/auth/presentation/pages/`: migrate `email-entry-page.vue`, `verify-otp-page.vue`, `home-page.vue` — in-place value swap only (e.g. `calc(var(--spacing-xl) + env(safe-area-inset-top, 0px))` → `calc(var(--spacing-xl) + var(--safe-top))`); no structural change
- [x] 2.4 `src/features/user/presentation/pages/onboarding-page.vue`: same in-place swap
- [x] 2.5 `src/features/map/presentation/components/`: migrate `map-action-overlay.vue`, `location-picker.vue`, `tour-action-bar.vue`
- [x] 2.6 `src/features/onboarding/presentation/components/`: migrate `onboarding-welcome.vue`, `onboarding-tour-banner.vue`
- [x] 2.7 `src/features/tours/presentation/components/tour-attachment-viewer.vue`: migrate all inset usages (header top/right/left + footer/nav/dots bottom/left/right — 7 sites)
- [x] 2.8 `src/features/tour-links/presentation/pages/backfill-collisions-page.vue`: add standalone page-root `min-height: -webkit-fill-available; min-height: 100lvh;`, `background-color: var(--color-background);`, and safe-area-aware padding for `.page--standalone`; keep embedded `mode="all"` layout unchanged
- [x] 2.9 Verify sweep complete: `grep -rn "env(safe-area-inset" src/` returns ONLY the four definitions in `src/app/theme/safe-area.css`

## 3. Verification

- [x] 3.1 `npx eslint . --fix` clean (zero warnings); review diff size for editor-reformat noise (value-only change should stay small)
- [x] 3.2 `npm run type-check` clean
- [x] 3.3 `npm run test` green (108 files, 1058 tests pass)
- [x] 3.4 Device visual check (iPhone, Add to Home Screen → standalone): auth white under notch, map tiles under notch, snackbar above home indicator, FAB above Android nav bar — confirm no regression vs current `main` (token sweep should be pixel-identical). Additionally verify `backfill-collisions-page` standalone (friendship deeplink) now paints its background under the notch; confirm embedded `mode="all"` layout is unchanged

## 4. Finalize

- [x] 4.1 Run `npx eslint . --fix` once more and confirm working tree is clean of unintended changes
- [x] 4.2 Prompt user to commit (do NOT auto-commit) with message: `refactor(theme): source safe-area insets from tokens (#146)`
- [x] 4.3 Prompt user to push branch and open a PR against `main`; reference issue #146
- [x] 4.4 After merge, prompt user to archive this change via `/opsx:archive`
