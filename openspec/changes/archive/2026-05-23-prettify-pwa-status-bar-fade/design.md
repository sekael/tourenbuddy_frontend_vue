## Context

iOS PWA (installed to home screen) renders with `apple-mobile-web-app-status-bar-style=black-translucent` and `viewport-fit=cover`. The browser draws status bar text over the web view, which is correctly sized to the full screen. However, the app currently paints `body { background: var(--color-status-bar) #2563eb }` and pages declare `min-height: 100vh`. On iOS the layout viewport excludes the dynamic toolbar zones in some states, so page content stops short of the safe-area; the body's blue shows through as a band above content. On Android PWA the home indicator overlaps action overlays anchored to `bottom: 0`.

Already-correct:
- `viewport-fit=cover` meta
- `apple-mobile-web-app-status-bar-style=black-translucent`
- `--safe-*` tokens read `env(safe-area-inset-*)`

## Goals / Non-Goals

**Goals:**
- Every page paints to the physical edge of the screen on iOS + Android PWA.
- No solid color band in the top safe-area on any route.
- Interactive controls stay within the safe-area (not obscured by Android home indicator).
- One global pattern; pages opt into it via a single root style, not per-page bespoke fixes.

**Non-Goals:**
- Changing the brand/theme color (`--color-status-bar` token may stay for non-PWA fallback).
- Hiding status-bar icons or changing their tint.
- Refactoring layout architecture beyond root-element sizing + safe-area handling.
- Desktop visual changes (safe-area insets are 0 on desktop — pattern degrades gracefully).

## Decisions

### Decision 1: Body background → `transparent`

Make `body` transparent so the actual page root paints the safe-area. Status-bar zone fills with whatever the page chooses (image, map tiles, surface color).

**Alternative considered**: keep body blue, add per-page `position: fixed; top: 0; height: 100dvh` to extend backgrounds. Rejected — every page needs special-casing, easy to forget, drifts.

### Decision 2: Page roots use `min-height: 100dvh` with `-webkit-fill-available` fallback

`100dvh` = dynamic viewport height (always matches visible viewport, including safe-area). `-webkit-fill-available` covers older iOS that pre-dates `dvh`.

```css
.page-root {
  min-height: 100dvh;
  min-height: -webkit-fill-available; /* fallback first, dvh wins where supported */
}
```

Order matters: put fallback before `dvh` so newer browsers override. Actually browsers cascade last-valid wins; `dvh` is well-supported (iOS 15.4+, all evergreen). Acceptable.

**Alternative**: `height: 100vh` on `<html>`. Rejected — `100vh` is the buggy unit on iOS.

### Decision 3: Page background extends behind notch by NOT padding the root

Page root does NOT apply `padding-top: env(safe-area-inset-top)`. Its background fills the whole viewport including the safe-area. Inner *content* containers apply `padding-top: env(safe-area-inset-top)` so headings/buttons stay below the notch.

```
.page-root                 ← background image/color, no top padding
  └─ .page-content         ← padding-top: env(safe-area-inset-top)
        h1, button, …
```

### Decision 4: Bottom safe-area handled at the overlay, not the page

Map canvas extends to the bottom edge. Action bar / FAB / bottom sheet handle owns its own `padding-bottom: env(safe-area-inset-bottom)` (or `margin-bottom`) so the touch target sits above the Android gesture bar / iOS home indicator. Same for any future bottom nav.

### Decision 5: Keep `--color-status-bar` token, demote to fallback role

Some flows may briefly show body before the page mounts (route transitions, suspense). Keep token but apply it as a fallback `<html>` background, not body. This way the brief flash matches brand, but a mounted page's own background takes over immediately.

Actually simpler: drop the body color entirely. Brief flashes are bounded by initial mount only — root index.html can have its own `<style>` if needed later. For now: body transparent, `<html>` keeps `--color-background` so a half-rendered state still looks neutral.

## Risks / Trade-offs

- **Risk**: Page that forgets to apply `.page-root` styling shows `<html>` background (light surface) in status-bar zone — looks blank but not broken. → Mitigation: add `min-height: 100dvh` to a shared base layer (e.g., `#app`) so default behavior is correct even without per-page styling.
- **Risk**: Map action overlay touch targets currently sit at `bottom: var(--spacing-md)` — adding safe-area padding shifts them up visually on devices without a home indicator (insets = 0, so no change). On Android with gesture nav, they move up to clear gesture bar. → Acceptable; that's the goal.
- **Risk**: Older iOS (< 15.4) lacks `dvh`. → `-webkit-fill-available` fallback. Acceptable.
- **Risk**: Pages with scroll containers (`tours-list`, `contacts`) need their scrollable inner element to handle safe-area on bottom so last list item is reachable. → Audit during implementation; apply `padding-bottom: env(safe-area-inset-bottom)` to scroll wrappers.
- **Trade-off**: `100dvh` recalculates on viewport-bar show/hide, which can cause minor reflows during scroll on iOS Safari (in-browser, not PWA). PWA mode is the priority target; standalone display rarely shows/hides bars. Acceptable.

## Migration Plan

1. Apply global CSS changes (body transparent, base `#app` sizing).
2. Audit each routed page; ensure root container owns full-viewport background.
3. Audit map overlays for `padding-bottom: env(safe-area-inset-bottom)`.
4. Manual QA on iOS PWA (real device) + Android PWA (real device or emulator) + desktop.
5. Rollback = revert single PR; no data, no DB, no schema.

## Open Questions

- None outstanding (scope + fallback behavior confirmed with user).
