## Why

On iOS PWA install, status-bar zone renders a solid blue band above page content (see GH #176). Cause: `body` paints `--color-status-bar` and pages do not extend behind the notch — only when content scrolls does the page background slide under the status bar. This looks broken on the home page (background image cut off) and map view (tiles cut off). Fix once, globally, so every page presents immersive-edge by default.

## What Changes

- Body background becomes transparent; pages own the full viewport including safe-area zones.
- Page roots size to `100dvh` (with `-webkit-fill-available` fallback) and paint their own background (image, map canvas, or surface color) edge-to-edge — including under the top notch and bottom home indicator.
- Interactive overlays (map action bar, FAB, bottom navigation, tour info sheets) keep clear of the bottom safe-area via `padding-bottom: env(safe-area-inset-bottom)`; the map canvas itself extends underneath.
- Apply across all routed pages (home, auth flows, tours list/detail, map, profile, contacts).
- Meta tags unchanged (`viewport-fit=cover` + `apple-mobile-web-app-status-bar-style=black-translucent` already correct).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `pwa-support`: add requirement that PWA pages extend content into safe-area zones with interactive controls staying inside the safe area.
- `design-system`: redefine root layout contract — body transparent, page roots fill dynamic viewport, safe-area tokens applied to interactive overlays not page backgrounds.

## Impact

- `index.html`: no change (meta already correct).
- `src/app/theme/global.css`: body background → transparent; document a `.page-root` pattern.
- `src/app/theme/tokens.css`: keep `--safe-*` tokens; `--color-status-bar` becomes a fallback-only token (or removed).
- All page components under `src/features/*/presentation/pages/` and `src/features/auth/presentation/pages/`: ensure root uses `min-height: 100dvh` and owns its background.
- Map components (`src/features/map/presentation/components/*`): action overlays gain `padding-bottom: env(safe-area-inset-bottom)`; map canvas reaches edges.
- Visual regression risk on every page — manual test plan covers iOS PWA, Android PWA, desktop, and short-content scroll case.
