## Context

The tour action-bar pill renders full-width at app start (issue #232). Verified mechanism: Material Symbols icons are ligatures rendered as literal DOM text in `base-icon.vue` (`<span class="material-symbols-outlined">location_on</span>`); before the CDN icon font loads that text paints in a fallback font, and the pill (`position: fixed` + `white-space: nowrap`, no width) shrink-to-fits to the viewport. A `fonts-ready` gate in `global.css` box-constrains icons during load, but a 3s safety-net timeout in `main.ts` lifts it even when the font never loaded → balloon on slow/cold starts.

The narrow fix (a permanent CSS box-constraint) closes the bug but leaves the deeper issues: fonts come from the Google Fonts CDN (client-IP leak to Google — GDPR concern for a Swiss/EU app), don't work offline, and are throwaway if the app is later shipped natively. This change removes the web-font CDN entirely instead of patching the symptom.

## Goals / Non-Goals

**Goals:**
- No web-font CDN dependency. All fonts and icons bundled and precached, offline-capable, no third-party origin.
- Issue #232 fixed by construction: an icon's rendered box is independent of any text, so no font-load state can affect layout.
- Keep the same visual result: real Inter for text, the same Material Symbols glyphs for icons.
- Durable toward a possible future native build (bundled assets translate directly).

**Non-Goals:**
- Icon-font subsetting (superseded by SVG).
- Runtime-caching the CDN (superseded — nothing external left to cache).
- Redesigning icons or the `<BaseIcon name="…">` public API.
- Runtime axis animation (FILL/wght transitions) — icons are static per component; each icon ships as a single SVG variant.

## Decisions

### Decision 1: Bundle Inter (self-hosted), drop it from the CDN

Import Inter via `@fontsource/inter` **static weights 400/500/600** — a weight audit confirms components use exactly regular/medium/semibold and never bold (700). The variable package is rejected: no arbitrary-weight or axis-animation need here, and it ships ~8× the bytes. The woff2 files land in the build output and are already covered by the existing `injectManifest` glob (`**/*.{…,woff2}`), so they precache with no vite change.

**Why over alternatives:**
- *System font stack (no Inter shipped)*: zero bytes but off-brand and platform-varying; loses the specific Inter letterforms the design chose. Rejected — decided to keep real Inter.
- *Keep CDN + runtime-cache*: still leaks client IP to Google and is throwaway for native. Rejected.

### Decision 2: Replace the Material Symbols icon font with tree-shaken SVGs

Use `unplugin-icons` with the Iconify `@iconify-json/material-symbols` set. `base-icon.vue` becomes a thin wrapper that resolves a name to an SVG component. Because some icon names are chosen at runtime (`TOUR_TYPE_ICONS[...]`, prop-passed `:name`), tree-shaking can't rely on static per-call imports; instead a **central registry** (`icons.ts`) maps each internal name to its imported Iconify SVG. `BaseIcon` looks up the registry, so all 155 call sites keep the `<BaseIcon name="…">` API unchanged.

The Material Symbols glyphs are used as their **official SVGs** — no manual redraw. Iconify names are kebab-case (`location-on`) vs our underscore (`location_on`); the registry is where that mapping lives. Use the **Outlined** variant. The Iconify set ships a single weight (400); today's icons render at `wght 300`, so SVG icons will be a hair heavier. This is accepted (imperceptible at icon sizes) rather than hand-managing weight-300 SVGs from Google's repo — verified acceptable in the visual-parity review. `FILL` is always 0 (no filled icons anywhere), and the unused `weight` prop is dropped.

**Why over alternatives:**
- *Subset the icon font*: smaller diff (keeps the ligature model) but still needs a central registry for the dynamic names (same machinery), still requires a font-rebuild step on every new icon, and keeps a font-load path. SVG removes the font entirely, tree-shakes per-use, and adds future icons by a one-line registry entry. Rejected in favor of SVG.
- *Ship full icon font (self-hosted, ~3.4MB)*: exceeds `maximumFileSizeToCacheInBytes` and bloats first load. Rejected.

### Decision 3: Delete the icon-font fail-safe apparatus

With SVG icons there is no ligature source text to hide and no font-load race to guard. Remove the `.material-symbols-outlined` base + `html:not(.fonts-ready)` rules from `global.css` and the `markFontsReadyOnLoad` / `fonts-ready` / 3s-timeout logic from `main.ts`. This is a net simplification — the change removes more runtime code than it adds.

### Decision 4: Icons render at a fixed intrinsic size (the #232 guarantee)

An SVG icon carries `width`/`height` from `1em` (token-driven), independent of any text content. The pill therefore sizes to `label + fixed icon boxes` on first paint, regardless of font/network state. No dedicated balloon guard is needed once the ligature font is gone.

## Risks / Trade-offs

- **Icon visual drift vs. today** (weight 300 outline, optical size) → Mitigation: pin the Iconify variant/weight in the registry and eyeball a before/after of a representative screen (map bar, tour info sheet, contact detail) before merge.
- **CSS selectors that style icons by `.material-symbols-outlined`** (in `tour-info-sheet.vue`, `contact-detail-view.vue`, `contact-action-menu.vue`, `contact-form.vue`) stop matching after migration → Mitigation: update those selectors to target the SVG element (e.g. the wrapper class or `svg`) as part of the change; covered by tasks.
- **Large refactor for a bug ticket** → Mitigation: the funnel is a single wrapper (`base-icon.vue`) + registry; the 155 call sites and public API are untouched, keeping blast radius contained. If faster de-risking is ever needed, the 2-line permanent-CSS-constraint fix remains available as an interim #232 close — but the durable change supersedes it and is the chosen path.
- **New dev dependencies** (`unplugin-icons`, `@iconify-json/material-symbols`, `@fontsource/inter`) → all build-time / bundled, none at runtime; removes an external network dependency on net.

## Migration Plan

Standard frontend deploy — no data migration, no DB change. The service-worker change reaches existing users via the existing `registerType: 'prompt'` update flow. Rollback = revert the change; the app returns to the CDN `<link>`.

## Open Questions

- Iconify variant/weight to pin for exact parity with today's weight-300 Outlined — resolved during implementation by visual comparison, not a blocker.
