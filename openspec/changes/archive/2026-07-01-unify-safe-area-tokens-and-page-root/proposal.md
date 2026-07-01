## Why

#231 introduced safe-area tokens (`--safe-top/-right/-bottom/-left` in `safe-area.css`), reverted `body` to transparent, standardized page sizing on `100lvh`, and made the primary routed pages paint their own background under the notch (`backfill-collisions-page` was missed). But most of the codebase still hardcodes raw `env(safe-area-inset-*)` inline (~15 files), so insets have no single source — there is no one place to later add a minimum-padding floor and no guard against drift. Issue #146 asked for that unification plus a `.page-root` utility; since #231 already delivered the per-page notch behavior, the remaining work is purely the token sweep.

## What Changes

- **Token unification (issue Part 1):** Replace every inline `env(safe-area-inset-*)` usage across `src/` (~15 files) with `var(--safe-*)`. The only place that resolves `env()` remains `src/app/theme/safe-area.css`, which defines the tokens. This is an in-place value swap except for `backfill-collisions-page`, which gets the same standalone page-root sizing/background contract as other routed pages. Page roots that fuse spacing and inset (e.g. `calc(var(--spacing-xl) + env(safe-area-inset-top))`) become `calc(var(--spacing-xl) + var(--safe-top))`. Interactive/fixed chrome (snackbars, FABs, action bars, sheets, drawers, `full-screen-page.vue`) keeps inset on `top/bottom/left/right`, just sourced from the token.
- **`.page-root` utility (issue Part 2) — DROPPED.** #231 already made routed page backgrounds work via per-page rules (`email-entry`, `verify-otp`, `onboarding`, `home` hero, `map`). `backfill-collisions-page` is the remaining routed-page outlier and will be brought into the same contract directly. A shared `.page-root` class would still be a pure DRY refactor of already-working code, carrying restructure risk for no behavior gain — deliberately out of scope.
- **Already landed in #231, out of scope:** `body` transparent revert, `--color-status-bar` token removal, `html` neutral fallback, per-page notch background. Note: the deployed `design-system` spec still reads `100dvh`; since this change edits that requirement for the token swap, it reconciles the text to the `100lvh` the code already uses.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `design-system`: safe-area insets are consumed via `var(--safe-*)` tokens (raw `env()` confined to `safe-area.css`); the page-root sizing requirement is reconciled from `100dvh` to the `100lvh` already in code and re-stated to source insets from tokens; overlay safe-area requirement re-stated in token terms.
- `pwa-support`: interactive-controls-clear-of-bottom-safe-area requirement re-stated to source the inset from `var(--safe-bottom)` rather than inline `env(safe-area-inset-bottom)`.

## Impact

- **CSS/theme:** `src/app/theme/safe-area.css` is the sole `env()` site (unchanged). No new utility class.
- **Pages:** `email-entry-page`, `verify-otp-page`, `home-page`, `onboarding-page` get in-place env→var swaps. `backfill-collisions-page` gets standalone page-root sizing/background/padding. `map-page` has no `env()` usage — verify full-screen sizing only.
- **Components (inset sourcing only):** `pwa-install-banner`, `update-prompt`, `error-snackbar`, `map-action-overlay`, `bottom-sheet`, `full-screen-page`, `tour-attachment-viewer`, `location-picker`, `tour-action-bar`, `onboarding-welcome`, `onboarding-tour-banner`.
- **No** API, dependency, or schema change. The token sweep is pixel-identical (`var(--safe-*)` resolves to the same `env(...)` it replaces). The **only** visual change is `backfill-collisions-page` standalone mode gaining the notch-safe background/sizing it was missing — every other surface is unchanged.
- Verification: `npx eslint .` clean, `npm run type-check` clean, `npm run test` green, plus a quick iPhone standalone-PWA visual check for no regression.
