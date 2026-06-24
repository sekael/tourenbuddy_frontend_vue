## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/76-standardize-app-theme`

## 2. Phase 1 — Token foundation (two-tier CSS)

- [x] 2.1 Restructure `src/app/theme/tokens.css` into a **primitive** tier: palette ramps (`--slate-*`, `--blue-*`, error/success), spacing scale, radius scale, raw shadows — reproducing every current value exactly
- [x] 2.2 Add a **semantic** tier in `tokens.css` that references primitives via `var()` (`--color-primary: var(--slate-600)`, `--color-surface`, …); keep existing semantic token names stable (no renames of consumed tokens)
- [x] 2.3 Apply the same primitive/semantic split to `typography.css` (font sizes/weights/line-heights)
- [x] 2.4 Relocate the safe-area `env()` custom properties (`--safe-*`) out of `tokens.css` into hand-written global CSS (`global.css` or a dedicated `safe-area.css` imported by `global.css`)
- [x] 2.5 Verify **resolved-value parity**: computed styles are unchanged vs. before (spot-check key tokens in the running app / a small test); no visual diff

## 3. Phase 2 — Shared Button + IconButton + Icon components

- [x] 3.1 Audit the 49 ad-hoc `<button>` usages and 186 `material-symbols-outlined` usages to enumerate real variants/sizes/states (label vs icon-only, loading, disabled, full-width); confirm tabs/segmented toggles are excluded
- [x] 3.2 Add any missing semantic tokens for button/icon-button/icon sizing surfaced by the audit
- [x] 3.3 Implement `src/core/components/base-button.vue` (action, with label): props `variant` (primary/secondary/danger) + `size` (sm/md/lg), forwards native button attrs, label slot, token-driven styling, hover scale on primary
- [x] 3.4 Implement `src/core/components/base-icon-button.vue` (icon-only, square): props icon `name` + `size`, forwards native attrs + `disabled` + accessible label (`aria-label`/`title`); distinct from circular `round-action-button`
- [x] 3.5 Implement `src/core/components/base-icon.vue`: props `name` + `size`/`weight`, wraps `material-symbols-outlined`, token-driven sizing
- [x] 3.6 Add Vitest component tests under `test/core/components/` for all three, covering edge/failure cases (unknown variant fallback, disabled blocks click, missing name/label) per testing conventions

## 4. Phase 3 — Document the design language

- [x] 4.1 Write root `DESIGN.md`: palette, spacing/radius/font scales, shadows, typography, `Button`/`IconButton`/`Icon` anatomy + variants, usage rules and rationale; flag tabs/segmented-toggle extraction at second usage; reference `tokens.css` as canonical for exact values (no second value list); note that any design work based on it must be supplemented with up-to-date screenshots captured at time of use (no screenshots stored now)

## 5. Phase 4 — Migrate features onto tokens + components

> One commit per feature group; verify the app visually after each (no visual change).

> Per group: hardcoded hex/font-size/radius → tokens; action buttons → `Button`; icon-only buttons → `IconButton`; inline icons → `Icon`; tabs/toggles → tokenized in place (not componentized).

- [x] 5.1 **core/**: `crosshair.vue`, `bottom-sheet.vue`, `dialog-window.vue`, `side-drawer.vue` (close/back icon buttons) and other shared components
- [x] 5.2 **auth/**: `home-page.vue`, `verify-otp-page.vue`
- [x] 5.3 **tours/**: `tour-list-sheet.vue`, `tour-attachment-viewer.vue`, `tour-form.vue` (+ remaining tour components with literals/buttons)
- [x] 5.4 **contacts/**: `contact-detail-view.vue`, `contacts-list-sheet.vue`, `group-sms-confirm-dialog.vue`
- [x] 5.5 **user/**: `phone-verification-dialog.vue`, `user-profile-sheet.vue`
- [x] 5.6 **friendships/**: `block-confirm-dialog.vue`, `connect-prompt.vue`, `friend-requests-sheet.vue`
- [x] 5.7 **map/**: `map-speed-dial-menu.vue`
- [x] 5.8 **tour-links/**: `collision-notice.vue`, `link-request-banner.vue`
- [x] 5.9 Final sweep: re-run the hardcoded-value survey (hex / `font-size` / `border-radius` literals) **and** grep for raw `material-symbols-outlined` spans and ad-hoc `<button>` styling; confirm **zero** icon-span stragglers (full migration, no tail) and only intentional exceptions for the rest; migrate any remaining

## 6. Finalize

- [x] 6.1 Run `npm run test` (all pass) and `npm run type-check`
- [x] 6.2 Run `npx eslint . --fix` and verify the diff stays minimal (no editor reformat noise); zero warnings
- [ ] 6.3 Prompt the user to commit (atomic, per-phase/per-feature) with a ready-to-copy conventional commit message, e.g. `feat(theme): standardize two-tier design tokens and shared Button/Icon (#76)`
- [ ] 6.4 Prompt the user to push and open a PR to `main`; confirm CI (lint, type-check, vitest) is green and check the preview deploy for visual regressions
- [ ] 6.5 Prompt the user to archive this change with the openspec-archive skill
