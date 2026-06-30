## Context

#231 ("standardize app theme") already landed most of the structural half of issue #146: `body` is transparent (`global.css:30`), `html` paints a neutral fallback (`global.css:21`), the `--color-status-bar` token is gone, page sizing is `100lvh`, and primary routed pages paint their own background under the notch via per-page rules (auth/onboarding `.page` blocks, the map canvas, the home hero). What remains is consistency work: most of `src/` still hardcodes `env(safe-area-inset-*)` inline (~15 files), so there is no single source for the inset value. `backfill-collisions-page` is the remaining routed-page outlier and needs the same standalone page-root sizing/background contract.

The deployed `design-system` spec still reads `100dvh`; the code is `100lvh`. `lvh` is correct under `viewport-fit=cover` because it includes the safe-area zones (the page box reaches the physical edges), whereas `dvh` excludes them in iOS standalone PWA. This change reconciles the spec to the code because it edits that requirement anyway for the token swap.

## Goals / Non-Goals

**Goals:**
- Single source for safe-area insets: `var(--safe-*)`, with raw `env()` confined to `safe-area.css` — so a future floor (e.g. `max(env(...), 8px)`) lives in one place.
- Token sweep is zero behavior/visual change: `var(--safe-X)` resolves to the same `env(safe-area-inset-X, 0px)` it replaces. Sole intended visual change: `backfill-collisions-page` standalone mode gains the notch-safe background/sizing it currently lacks.

**Non-Goals:**
- A `.page-root` utility (see D1). Per-page rules are enough; a shared class would refactor working code at restructure risk for no gain.
- Touching `body`/`html`/status-bar (#231), token names, or fallbacks (issue out-of-scope).
- A global app-bar (issue out-of-scope).
- Adding the minimum-padding floor now — the token indirection just makes it possible later.

## Decisions

**D1 — Drop the `.page-root` utility (revises issue Part 2).** The auth and onboarding pages already carry identical `.page` blocks (`min-height: 100lvh` + `background-color: var(--color-background)` + `calc(--spacing-xl + env(...))` padding) from #231, and `home-page`/`map-page` already extend correctly. Introducing `.page-root` and migrating these would be a pure DRY refactor of working code. Worse, the utility's `padding: var(--safe-*)` collides with each page's existing `calc(--spacing-xl + safe)` breathing-room padding, forcing a per-page restructure (move spacing onto an inner wrapper) — visual-regression risk for zero behavior gain. Skipped. Pages instead keep per-page rules, with `backfill-collisions-page` brought up to the same standalone contract directly. _Alternative considered:_ ship the utility for future pages only — rejected as a class with zero or one consumer.

**D2 — Migration is an in-place value swap, except `backfill-collisions-page`.** Each `env(safe-area-inset-X, 0px)` becomes `var(--safe-X)`. Bare `env(safe-area-inset-X)` call sites are standardized the same way: `var(--safe-X)`. Where a page fuses spacing and inset, `calc(var(--spacing-xl) + env(safe-area-inset-top, 0px))` becomes `calc(var(--spacing-xl) + var(--safe-top))`. No DOM, layout, or selector changes for existing styled pages — diff is value-only. `backfill-collisions-page` adds standalone `min-height`, background, and safe-area padding to match other routed pages while preserving embedded mode.

**D3 — `safe-area.css` stays the sole `env()` site.** The tokens are defined there as `env(safe-area-inset-X, 0px)`. Everything else references the token. The `, 0px` fallback lives in the token definition, so all call sites collapse to `var(--safe-*)` with consistent fallback behavior.

**D4 — `map-page` keeps fixed full-screen sizing.** Grep shows no inline `env(safe-area-inset-*)`. `map-page` should keep `height: -webkit-fill-available; height: 100lvh; overflow: hidden;` so the map canvas fills the physical viewport and draws under the notch/home-indicator zones. Safe-area tokens belong only on interactive chrome inside the map (FABs, action bars, sheets), not on the canvas/page container.

## Risks / Trade-offs

- **Bare `env(safe-area-inset-bottom)` call sites** → `var(--safe-bottom)` carries the `, 0px` fallback from the token definition; behavior is equal-or-safer on browsers without the inset. No risk.
- **Grep-based acceptance can miss `env()` reintroduced later** → the spec scenario codifies "only `safe-area.css` matches"; an eslint guard is possible but out of scope here.
- **Editor reformat noise** (known: antfu vs format-on-save) → run `eslint --fix` and review diff size so the value-only change doesn't balloon.

## Migration Plan

1. Sweep: `env(safe-area-inset-X)` → `var(--safe-X)` across the ~15 files; leave `safe-area.css` untouched.
2. Add standalone sizing/background/safe-area padding to `backfill-collisions-page` while keeping embedded mode unchanged.
3. Confirm grep returns only the four `safe-area.css` definitions.
4. Lint / type-check / test; quick device visual check for no regression.

Rollback: pure CSS value refactor, revert the branch — no data, API, or structural surface touched.

## Open Questions

None. Scope, sweep breadth, and the page-root drop were resolved before/during proposal (remaining-delta vs #231; all ~15 env() sites; utility dropped; `backfill-collisions-page` gets direct standalone page-root styling).
