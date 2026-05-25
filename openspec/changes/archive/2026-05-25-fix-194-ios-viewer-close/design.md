## Context

`tour-attachment-viewer.vue` renders as a `position: fixed; inset: 0` overlay teleported to `<body>`. On iOS PWAs (`display-mode: standalone`), the status bar overlays the viewport top; the header (`padding: var(--spacing-md) var(--spacing-lg)`) provides no top safe-area inset, so the close button sits under the status bar and is untappable (issue #194). Android PWAs in standalone mode with `viewport-fit=cover` exhibit the same risk: Chrome reports the system status bar via `env(safe-area-inset-top)` and the gesture nav bar via `env(safe-area-inset-bottom)`. The viewer's existing touch handler tracks only the X axis (`onTouchStart` / `onTouchEnd` at lines 161–178), so there is no gesture-based dismissal fallback.

Other overlays in this codebase (auth pages, bottom-sheet, snackbar, map overlay) already use the pattern `calc(var(--spacing-X) + env(safe-area-inset-Y, 0px))`. We will follow that pattern. The pattern is platform-agnostic — same CSS covers both iOS and Android because both platforms set the `env()` values from the OS chrome.

## Goals / Non-Goals

**Goals:**
- Close button reachable on both iOS and Android standalone PWAs.
- Bottom chrome clears the iOS home indicator and Android gesture nav bar.
- A native-idiomatic gesture fallback (swipe-down) dismisses the viewer — matches Apple Photos and Google Photos behavior.
- Horizontal swipe navigation continues to work without regression.

**Non-Goals:**
- No pinch-zoom, no drag-to-dismiss animation, no rubber-band physics.
- No changes to PDF rendering, signed-URL retry, or attachment data model.
- No global safe-area handling refactor.

## Decisions

### Apply safe-area insets via CSS only, scoped to the viewer

Use `calc(var(--spacing-md) + env(safe-area-inset-top, 0px))` on `.viewer__header` and `calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px))` on `.viewer__dots` and `.viewer__pdf-nav`. The `0px` fallback keeps non-iOS browsers unchanged.

**Alternative considered:** wrap the viewer in a global "safe-area-aware" layout component. Rejected — overkill for one component; the codebase has no such abstraction yet, and other overlays inline the calc the same way.

### Swipe-down only, classified by dominant axis with separate thresholds

Track `touchStartX` and `touchStartY` in `onTouchStart`. In `onTouchEnd`, compute `dx`, `dy`. If `dy > 0`, `dy > |dx|`, and `dy >= CLOSE_THRESHOLD` (80 px) — emit `close`. Else if `|dx| >= NAV_THRESHOLD` (existing 40 px) AND `|dx| > |dy|` — navigate prev/next. Otherwise no-op (includes upward swipes, which are intentionally ignored).

A higher threshold for close (80 px) than for nav (40 px) avoids accidentally closing the viewer when the user makes a slightly diagonal navigation swipe. Swipe-down matches the native dismiss gesture in Apple Photos and Google Photos; swipe-up is reserved (could later open a metadata sheet, but out of scope here).

**Alternative considered:** bidirectional vertical close. Rejected per user preference — non-idiomatic and risks conflicting with future swipe-up affordances.

### Apply touch handlers at the viewer root (existing placement)

Existing `@touchstart.passive` / `@touchend.passive` are on the root `.viewer` div, so PDF canvas swipes also work. Keep this — consistent UX, and the PDF page-nav buttons sit inside the same root so they're not affected (taps don't trigger swipe logic because `|dx|` and `|dy|` stay below thresholds).

## Risks / Trade-offs

- **[Risk]** A user trying to scroll a tall image vertically could trigger close. → Mitigation: the viewer uses `object-fit: contain` and the image is always sized to the viewport — there's nothing to vertically scroll. PDF canvas is the same.
- **[Risk]** `env(safe-area-inset-top)` only resolves non-zero when the document has `viewport-fit=cover`. → Confirm `index.html` viewport meta includes `viewport-fit=cover` during implementation; the bug report implies it does (auth pages already rely on the inset). Same caveat applies to Android Chrome PWAs.
- **[Risk]** Android-specific: some OEM skins display a translucent status bar by default; `env(safe-area-inset-top)` will still report the correct value as long as the PWA manifest uses `display: standalone` and the viewport meta opts into cover. → Verify on a real Android device in the manual-verification step.
- **[Trade-off]** No drag-to-dismiss animation — simpler implementation, but the close gesture is less discoverable. Acceptable since the visible close button is the primary affordance once safe-area is fixed.

## Migration Plan

Single component change, no data/migration impact. Ship behind no flag.
