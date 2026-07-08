## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/232-self-host-fonts-svg-icons`

## 2. Dependencies

- [x] 2.1 Add build deps: `npm i -D unplugin-icons @iconify-json/material-symbols`
- [x] 2.2 Add Inter: `npm i @fontsource/inter` (static 400/500/600) — pin to the weights `--font-family-base` uses.

## 3. Bundle Inter

- [x] 3.1 Import the needed Inter weights (400/500/600) in `src/main.ts` (or `global.css`).
- [x] 3.2 Confirm `--font-family-base` still resolves to `'Inter', <system stack>` in `tokens.css`/`global.css` (no change expected).
- [x] 3.3 Build and verify the Inter woff2 files land in `dist/` and are picked up by the existing `injectManifest` `woff2` glob (precached).

## 4. SVG icon system

- [x] 4.1 Register the `unplugin-icons` plugin in `vite.config.ts` (Vue-compatible config).
- [x] 4.2 Create the icon registry `src/core/components/icons.ts` mapping each internal icon name (underscore, as used across `<BaseIcon name="…">`) to its Iconify `material-symbols:*` SVG. Use the Outlined variant and match the current weight (300) for visual parity.
- [x] 4.3 Rewrite `src/core/components/base-icon.vue` to resolve `name` through the registry and render the SVG, preserving the existing props/sizing API (`size`, and equivalent of the weight axis if still needed) so all 155 call sites are unchanged.
- [x] 4.4 Audit every icon name actually used (including dynamic ones: `TOUR_TYPE_ICONS` values, prop-passed `:name`, ternary branches) and ensure each is present in the registry — a missing entry must fail loudly (dev-time error), not render blank.

## 5. Remove the CDN + fail-safe apparatus

- [x] 5.1 Remove the Google Fonts `<link>` and both `preconnect`s from `index.html`.
- [x] 5.2 Remove the `.material-symbols-outlined` base rule and the `html:not(.fonts-ready) .material-symbols-outlined` rule from `src/app/theme/global.css`.
- [x] 5.3 Remove `markFontsReadyOnLoad` and all `fonts-ready` / 3s-timeout logic from `src/main.ts`.
- [x] 5.4 Update the CSS selectors that style icons by `.material-symbols-outlined` in `tour-info-sheet.vue`, `contact-detail-view.vue`, `contact-action-menu.vue`, `contact-form.vue` to target the new SVG element (wrapper class / `svg`).

## 6. Verify

- [ ] 6.1 Issue #232: cold-load the map page with network throttled/offline — the pill sizes to its content and never spans the full viewport.
- [ ] 6.2 Offline: load online once, go offline, reload — Inter and all icons still render; DevTools Network shows zero requests to `fonts.googleapis.com` / `fonts.gstatic.com`.
- [ ] 6.3 Visual parity: eyeball map action bar, tour info sheet, and contact detail against `main` — icons match today's weight/outline; no clipping or size regressions.
- [x] 6.4 `npm run test` — all pass.
- [x] 6.5 `npm run type-check` — clean.

## 7. Document the design-system infra

- [x] 7.1 Update `.claude/conventions.md` (Styling section): document that icons are bundled **SVG via a central registry** (`src/core/components/icons.ts`) using `unplugin-icons` + Iconify `material-symbols` (Outlined, weight 400), and fonts are **self-hosted via `@fontsource`** (no Google Fonts CDN). State the exact steps to (a) add a new icon — add a registry entry mapping the internal name to `material-symbols:<kebab-name>` — and (b) add a new font weight — import the `@fontsource/inter/<weight>.css` and confirm the woff2 is covered by the `injectManifest` glob so it precaches.
- [x] 7.2 Update `CLAUDE.md` Stack section so it reflects SVG icons + self-hosted fonts (currently implies a Material Symbols/Inter CDN font), so future Claude sessions don't reintroduce the CDN.

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` then review the diff size (guard against editor reformat outside antfu style).
- [ ] 8.2 Prompt the user to commit with a ready-to-copy conventional commit message, e.g. `fix: self-host Inter and render icons as SVG, drop Google Fonts CDN (#232)`.
- [ ] 8.3 Prompt the user to push the branch and open a PR to `main`.
- [ ] 8.4 Prompt the user to archive this change with the `openspec-archive` skill once merged.
