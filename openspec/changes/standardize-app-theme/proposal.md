## Why

The design system has drifted: ~175 hardcoded values (52 hex colors, 77 literal font-sizes, 46 literal radii) live in 17+ components instead of the tokens defined in `tokens.css`/`typography.css`, and 49 ad-hoc `<button>` elements plus 186 inline `material-symbols-outlined` spans are styled per-file with no shared component. This makes the look inconsistent across mobile and desktop and makes any future restyle a manual sweep. Issue #76 asks to (1) standardize the theme and apply it consistently across the app, and (2) capture the design language as a single source of truth that can seed upcoming design sessions (e.g. in Stitch). The app target remains browser/PWA on mobile and desktop; native apps are out of scope.

## What Changes

- Restructure `tokens.css`/`typography.css` into an explicit **two-tier** token system, authored directly in CSS: a **primitive** tier (palette ramps, spacing scale, radius scale, font sizes/weights/line-heights, raw shadows) and a **semantic** tier (`--color-primary`, `--color-surface`, …) that references primitives via `var()`. Token **values remain equivalent to today's — no intended visual change.**
- Keep semantic tokens overridable so a later dark theme is a semantic-tier remap (dark mode itself is **deferred**).
- Move the safe-area `env()` custom properties out of `tokens.css` into hand-written global CSS — they are runtime functions, not design tokens.
- Add shared **Button** (action; variants + sizes), **IconButton** (inline icon-only; corner shape prop/token-driven, default round to preserve existing look — distinct by role from the fixed-size floating `round-action-button` FAB), and **Icon** (Material Symbols wrapper) components, with tests. Tabs and segmented toggles are each single-usage today, so they are **tokenized in place** to the same design language and flagged in `DESIGN.md` for component extraction at second usage — not extracted now (YAGNI).
- Migrate the ~175 hardcoded values onto tokens and migrate ad-hoc action `<button>`/icon-only-button/inline-icon usages onto the shared components, feature-by-feature, with no visual change.
- Add a root **`DESIGN.md`** documenting the design language — palette, scales, radius, shadows, typography, component anatomy, and usage rules — as the human/tool-readable source of truth for design sessions. No screenshots are produced in this change; `DESIGN.md` states that any design work based on it must be supplemented with up-to-date screenshots captured at time of use. `tokens.css` stays canonical for exact values; `DESIGN.md` is structure, rules, and rationale (no second copy of every value).

Explicitly **not** done: no JSON token pipeline / Style Dictionary / generated CSS (rejected — single CSS output, web-only target, indirection and tooling cost outweigh benefit; Stitch is seeded better by `DESIGN.md` + screenshots than by a token JSON). No visual redesign (a later, separate change once everything is tokenized).

## Capabilities

### New Capabilities

_None._ Behavior lives in the existing `design-system` capability.

### Modified Capabilities

- `design-system`: tokens gain an explicit primitive/semantic two-tier structure authored in CSS; button and icon styling conventions are promoted from per-file CSS to **shared `Button`/`IconButton`/`Icon` components** (tabs/toggles tokenized in place, extraction deferred); a new requirement mandates that application components consume tokens and shared components instead of hardcoded values; the design language is documented in a `DESIGN.md` source of truth.

## Impact

- **No new runtime deps, no build step, no generated files, no new CI check.**
- **New files:** root `DESIGN.md`, `src/core/components/base-button.vue`, `src/core/components/base-icon-button.vue`, `src/core/components/base-icon.vue` (+ tests under `test/core/components/`).
- **Edited theme files:** `src/app/theme/tokens.css`, `typography.css` (restructured, values preserved); `global.css` gains the relocated safe-area `env()` vars.
- **Touched components:** ~17 files with hardcoded colors/sizes/radii and all files using ad-hoc `<button>` / inline `material-symbols-outlined` (migrated feature-by-feature).
- **No DB / Worker / env changes.** No user-facing copy → no i18n keys added.
