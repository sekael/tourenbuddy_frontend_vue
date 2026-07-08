## Why

The app depends on the Google Fonts CDN for both Inter and the Material Symbols icon font (`index.html`). That dependency causes a user-visible bug and carries structural problems:

- **Bug (issue #232):** Material Symbols icons are ligatures rendered as literal DOM text (`location_on`). Before the icon font loads, that text paints in a fallback font, and the tour action-bar pill (`position: fixed` + `white-space: nowrap`, no width) shrink-to-fits to the full viewport → the pill spans the whole screen at app start. Intermittent because it depends on CDN latency vs. a 3s safety-net timeout.
- **Privacy:** loading fonts from `fonts.gstatic.com` leaks the client IP to Google on every visit — a GDPR concern for a Swiss/EU app.
- **Offline / durability:** the CDN font is not bundled, so icons don't render offline, and the whole approach is throwaway if the app is later shipped natively (native apps bundle all assets).

We fix the root, not the symptom: remove the web-font CDN entirely. Bundle Inter, replace the icon font with tree-shaken SVGs. The balloon then cannot happen *by construction* (SVG has no ligature source text), and the icon-font fail-safe apparatus can be deleted.

## What Changes

- **Bundle Inter** (self-hosted woff2, precached) and drop it from the CDN. Text renders in real Inter, offline, no third-party origin.
- **Replace the Material Symbols icon font with SVGs.** Icons render as bundled, tree-shaken SVG via `unplugin-icons` + the Iconify `material-symbols` set. `base-icon.vue` becomes a thin SVG wrapper backed by a central name→icon registry (needed because some icon names are chosen dynamically — `TOUR_TYPE_ICONS` lookup, prop-passed `:name`).
- **Remove the Google Fonts `<link>` and preconnects** from `index.html`.
- **Delete the now-obsolete icon-font fail-safe:** the `.material-symbols-outlined` box/visibility rules in `global.css` and the `markFontsReadyOnLoad` / `fonts-ready` / 3s-timeout logic in `main.ts`. With SVG icons there is no ligature text to hide and no font-load race to guard — net fewer runtime moving parts than today.
- **Issue #232 is resolved inherently:** SVG icons have a fixed intrinsic size from first paint, so the pill sizes to its content on every network condition.

Out of scope (deliberately): icon-font subsetting (superseded by SVG), runtime-caching the CDN (superseded — nothing external to cache), changing the Material Symbols icon *designs* (same glyphs, just as SVG).

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `design-system`: the Inter typography requirement changes from "load from Google Fonts CDN" to "bundled / self-hosted"; the Material Symbols icon requirement changes from "ligature font from CDN" to "bundled SVG via a shared Icon component + registry", including the guarantee that an icon's box is independent of any text (balloon impossible by construction).
- `pwa-support`: add a requirement that the app shell is self-contained — all fonts and icons are bundled/precached with no external font origin, so they render offline and on first paint.

## Impact

- `index.html` — remove Google Fonts `<link>` + `preconnect`s.
- `package.json` — add dev deps: `unplugin-icons`, `@iconify-json/material-symbols`; add `@fontsource/inter` (or `@fontsource-variable/inter`). No runtime CDN.
- `vite.config.ts` — register the `unplugin-icons` Vite plugin. Inter woff2 is already covered by the existing `woff2` precache glob.
- `src/core/components/base-icon.vue` — ligature span → SVG component driven by a name→icon registry.
- New `src/core/components/icons.ts` (or equivalent) — the icon registry mapping our internal names to Iconify `material-symbols:*` (outline variant, weight-matched).
- `src/app/theme/global.css` — remove `.material-symbols-outlined` base + `fonts-ready` rules; import Inter (`@fontsource`); keep `--font-family-base`.
- `src/main.ts` — remove `markFontsReadyOnLoad` + `fonts-ready` apparatus; add Inter import.
- ~4 feature components (`tour-info-sheet.vue`, `contact-detail-view.vue`, `contact-action-menu.vue`, `contact-form.vue`) — update CSS selectors that style icons by `.material-symbols-outlined` to target the new SVG element.
- All 155 `BaseIcon` call sites keep the `<BaseIcon name="…">` API unchanged — the migration is behind the wrapper.
- Service-worker change reaches existing users via the existing `registerType: 'prompt'` update flow.
