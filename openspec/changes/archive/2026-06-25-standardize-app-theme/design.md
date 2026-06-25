## Context

Tokens already exist in `src/app/theme/{tokens.css,typography.css}` (slate palette, 4-pt spacing, 3 radii, 3 shadows, font scale). But ~175 hardcoded values (52 hex, 77 font-sizes, 46 radii across 17+ files), 49 ad-hoc `<button>` elements, and 186 inline `material-symbols-outlined` spans have drifted away from them. Issue #76 wants two things: standardize the theme and apply it consistently, and have a single source of truth for the design language to seed upcoming design sessions (e.g. Stitch). Target stays browser/PWA (mobile + desktop); native apps are explicitly out of scope. This change consolidates the existing look — **no intended visual change** — and adds the structure, shared components, and documentation that prevent future drift.

## Goals / Non-Goals

**Goals:**
- Two-tier token system (primitive + semantic) authored directly in CSS, values equivalent to today's.
- Semantic tier overridable so a later dark mode is a remap, not a rewrite.
- Shared `Button` (variants + sizes) and `Icon` components; migrate ad-hoc usages onto them.
- Eliminate hardcoded color/size/radius literals in favor of tokens, feature-by-feature.
- A `DESIGN.md` (+ screenshots) capturing the design language as the source of truth for design sessions.

**Non-Goals:**
- Any deliberate visual redesign. Generated/restructured values are equivalent to today's. Tuning the look is a separate later change once tokenized.
- Dark mode implementation (structure for it only).
- A JSON token pipeline / Style Dictionary / generated CSS / multi-platform (native) export.
- Reworking the bottom-sheet / safe-area / page-root requirements (untouched, beyond relocating the env() vars).

## Decisions

### D1 — Two-tier tokens authored directly in CSS (no build pipeline)
Restructure `tokens.css` into a primitive tier (`--slate-600: #475569;`, spacing/radius/font scales, raw shadows) and a semantic tier that references primitives (`--color-primary: var(--slate-600);`). Hand-edited, no generator.
- **Why:** CSS custom properties alias natively, so the two-tier / dark-mode-ready structure costs nothing to express in CSS. This is a web-only PWA generating exactly one output (CSS) — Style Dictionary's multi-platform payoff doesn't apply.
- **Alternatives:** (a) DTCG JSON source + Style Dictionary → CSS — **rejected**: a single CSS output doesn't justify a dependency, a build step, generated-file discipline, and a CI drift-check; it adds indirection during the very phase tokens change most; its one unique payoff (machine-importable JSON) only matters if Stitch ingests DTCG, which is unverified and unlikely (Stitch is generative). (b) Tailwind/`@theme` — rejected: large stack change, not how this app styles.

### D2 — Design language captured in `DESIGN.md`, not a token JSON
A root `DESIGN.md` documents palette, scales, radius, shadows, typography, component anatomy, and usage rules.
- **Why:** This is the artifact a design session (Stitch or human) actually starts from. Stitch is generative — it benefits from descriptive context far more than from a token JSON. Costs nothing in tooling.
- **No screenshots in this change:** screenshots rot quickly (a design refresh is imminent). Instead, `DESIGN.md` instructs that any design work based on it must be supplemented with up-to-date screenshots captured at time of use. The durable deliverable is the text + token references.
- **Avoid duplication:** `tokens.css` stays canonical for exact values. `DESIGN.md` is structure, rules, and rationale; it points to `tokens.css` rather than re-listing every hex as a second source of truth that could drift.

### D3 — Value-equivalence first, then fill gaps
Restructuring into tiers preserves every current value exactly; verification is by **resolved-value comparison** (computed styles unchanged), not byte-diff. Only after parity do we add missing semantic tokens (e.g. button/icon sizing) the components need.
- **Why:** Keeps "no visual change" verifiable and separates "reorganize tokens" from "add new tokens."

### D4 — Safe-area `env()` vars leave `tokens.css`
The four `--safe-*: env(safe-area-inset-*)` properties move to hand-written global CSS (`global.css` or a dedicated `safe-area.css`).
- **Why:** `env()` is a runtime CSS function, not a static design token. Keeping it in the token file conflates two concerns; relocating it keeps `tokens.css` a clean value-only file (and a cleaner basis for `DESIGN.md`). Standard design-tokens practice: runtime/contextual values live in base CSS, not the token layer.

### D5 — `Button`, `IconButton`, `Icon` as `core/components`; standardize each button-kind within itself
`base-button.vue` (props: `variant`, `size`, native button attrs, label slot, click emit), `base-icon-button.vue` (icon-only, square; props: icon `name`, `size`, native attrs), and `base-icon.vue` (props: `name`, `size`/`weight`) under `src/core/components/`, token-driven, with Vitest tests (edge/failure cases per testing conventions).
- **Why three:** the codebase evidences high reuse of action buttons (`cancel-btn` 32, `submit-btn` 26, `action-btn` 19, …) and icon-only buttons (`back-btn` 18, `close-btn` 17, `icon-btn` 12, incl. core overlays) — each earns a reusable component. Glyphs appear 186×. Each button *kind* is standardized within itself; kinds with clearly different purposes are NOT merged.
- **Why not Tabs/SegmentedControl now:** tabs exist in **one** component (`friend-requests-sheet`) and segmented toggles in ~one. Extracting a reusable component for a single consumer is premature abstraction (YAGNI) against the "as little as possible" convention. Instead, **tokenize tabs/toggles in place** so they share the design language, and flag extraction in `DESIGN.md` for the second usage.
- **Why `core/`:** shared, feature-agnostic home (architecture rule: `core` never depends on features). `base-` prefix mirrors existing shared primitives (`base-tooltip.vue`). The existing `round-action-button.vue` (a fixed 52px floating FAB) is a distinct concern from the inline `IconButton` and stays as-is.
- **IconButton shape (resolved during apply):** ~all existing icon-only buttons (dialog/sheet/drawer close+back, viewer, contact-detail) are round (`border-radius:50%`); a few are `12px`. The original "square" wording would have caused an app-wide visual regression, so `IconButton`'s corner shape is **prop/token-driven, default round** to match dominant usage. It is distinguished from the FAB by role (inline, token-sized) not by corner sharpness.

### D6 — Migration is phased and feature-scoped
One OpenSpec change; the task list groups migration by feature area (auth, tours, contacts, map, friendships, tour-links, user, core). Each group is a self-contained, separately-committable unit verified visually.
- **Why:** Honors "small reviewable PRs / atomic commits" even within a single change; lets visual regression be checked feature-by-feature.

## Risks / Trade-offs

- **Silent visual drift during migration** → After each feature group, eyeball the app; rely on D3 resolved-value parity. The "no visual change" promise is the reviewer's rejection criterion for any value change.
- **`DESIGN.md` drifts from `tokens.css`** → Keep `DESIGN.md` structure/rules/rationale + screenshots, not a second value list; point to `tokens.css` for canonical values.
- **`Button`/`IconButton`/`Icon` props don't cover every ad-hoc case** (loading, full-width) → Audit the 49 buttons first; design props from real usages. Tabs/segmented toggles are explicitly excluded (tokenized in place, not componentized).
- **186 icon usages is a large migration** → Migrate per feature group alongside that group's buttons; the `Icon` component is a thin wrapper so each swap is mechanical.
- **Scope creep into redesign** → Non-Goal stated explicitly; any value change needs a separate decision.

## Migration Plan

1. Restructure tokens into two tiers (values preserved), relocate safe-area vars, verify resolved-value parity.
2. Build + test `Button`/`IconButton`/`Icon`; write `DESIGN.md` (no screenshots).
3. Migrate feature-by-feature (commit per group), each verified visually.
- **Rollback:** components/docs are additive; until a feature group is migrated it still uses existing CSS, so partial rollback = revert that group's commit.

## Open Questions

- None. (Resolved during grilling: CSS-authored tokens — no Style Dictionary; `Button`/`IconButton`/`Icon` components with tabs/toggles tokenized in place; full 186-icon migration with no tail; root `DESIGN.md` with no screenshots.)
