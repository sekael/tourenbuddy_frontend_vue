## Why

Issue #247: while the location picker is active, scrolling any other UI moves the map, so
the crosshair no longer sits over the point the user aimed at. Reported on iOS Safari and
Brave (iOS); the mechanism is not iOS-specific, so every mobile browser is presumed
affected.

The map page is already pinned — `.map-page` is `position: fixed; inset: 0; overflow:
hidden` (`map-page.vue:927`). What is **not** pinned is the *document*. `#app` carries
`min-height: 100lvh` (`global.css:38`) for every route, and `lvh` is the chrome-*hidden*
viewport height. With the browser chrome shown, the document is taller than the visual
viewport, so `<html>` has a scrollable overflow on the map route. A touch that starts
anywhere outside the map canvas — a sheet, the action bar, the picker's own button row —
scrolls or rubber-bands that document. The map canvas moves with it while MapLibre's
camera does not, so `map.unproject(centerPixel)` (`location-picker.vue:32`) resolves
against a canvas that has slid out from under the crosshair.

This is a known-and-solved failure mode in this codebase: the onboarding tour hits it for
the same reason (viewport-fixed spotlights drifting) and fixes it with
`html.tour-scroll-locked` — `overflow: hidden` **plus** `body { position: fixed; inset: 0 }`
(`onboarding-tour.css:11-21`), because on iOS `overflow: hidden` alone does not stop
momentum / rubber-band / address-bar scroll. Both `map-page.vue:341` and
`calendar-page.vue:222` toggle that class, with duplicated `onUnmounted` cleanup.

So the fix is not new machinery — it is applying the existing lock to the whole map route
instead of only to the tour, and giving it a home that is not the onboarding stylesheet.

## What Changes

- **The map route locks document scroll for its entire lifetime**, not just during the
  onboarding tour. Entering `/map` pins `<html>`/`<body>`; leaving it releases them. The
  map is then navigable only by MapLibre's own gestures — drag, pinch, rotate — which is
  exactly the issue's second half ("map page should never be scrollable").
- **The lock rule moves out of `onboarding-tour.css` into `app/theme/global.css`** and is
  renamed `html.scroll-locked`. It is no longer an onboarding concern: `onboarding-tour.css`
  is imported from `use-onboarding-tour.ts` and stays for driver.js popover overrides only.
  The rule carries `overflow: hidden` + `overscroll-behavior: none` on `html, body` and
  `body { position: fixed; inset: 0 }` — but **not** the tour rule's `touch-action: none`,
  which the tour never exercised (its subtree is `pointer-events: none` and carries its own
  `touch-action: none` at `map-page.vue:942`) and which is not needed to stop document
  scroll (design D3).
- **New `useScrollLock()` composable** in `core/composables/`, owning class toggle and
  unmount cleanup once. Both pages call it; `map-page.vue` passes nothing (locked while
  mounted), `calendar-page.vue` passes its `tourLockActive` getter.
- **`map-page.vue` loses its `tourLockActive` watch entirely** (`:337-343`) and the
  matching `onUnmounted` line (`:353`) — with the route always locked, the tour-scoped
  toggle is dead code. Net deletion, not addition.
- **Modal scroll containers gain `overscroll-behavior: contain`** — `bottom-sheet.vue:436`,
  `dialog-window.vue:159`, `side-drawer.vue:154`. Not `full-screen-page.vue:129`: a page
  has nothing behind it to chain into. Defence in depth on the map route (the pinned
  document cannot scroll anyway) and a real fix on the other routes, where a document does
  scroll behind an open dialog or drawer.
- **Map gestures are explicitly unaffected** — wheel-zoom, pinch, drag and rotate over the
  visible map keep working with an overlay open, because MapLibre owns
  `touch-action` on its own canvas container and drives the camera from raw
  pointer/wheel events. Now a stated requirement rather than an incidental property.
- **`seasons-gantt.vue:224`** — selector renamed to the new class.
- **One test**: the refcount's double-mount / single-unmount ordering. Nothing else here is
  observable in happy-dom (design D6).

Explicitly out of scope: hard-freezing scroll *inside* sheets while picking. Once the
document is pinned, sheet-internal scroll cannot move the map, and freezing it would make
the info sheet's edit form (`tour-form.vue:1059`, `overflow-y: auto`, taller than the
sheet) unreachable mid-pick — the user could not see the field the pick is filling. Also
out of scope: any change to other routes, to MapLibre gesture handlers, or to the picker's
coordinate maths.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `map-integration`: the map route gains a stated non-scrollable-document contract — the
  document never scrolls while the route is mounted, on any input (wheel, touch, momentum,
  rubber-band, address-bar), so the picker's crosshair-to-canvas mapping stays valid; the
  lock is released on leave so other routes scroll normally; and the map's own gestures
  (wheel-zoom, pinch, drag, rotate) remain fully available over the visible map while an
  overlay is open.
- `bottom-sheet`, `dialog-window`, `side-drawer`: each content scroll region gains a stated
  containment contract — scroll reaching either end SHALL NOT chain to any ancestor.

## Impact

- **Code**: new `src/core/composables/use-scroll-lock.ts`; CSS rule relocated from
  `onboarding-tour.css` to `global.css` under a new class name; edits to `map-page.vue`
  (net −8 lines), `calendar-page.vue`, `seasons-gantt.vue`, and one CSS line each in three
  core modal components.
- **Behaviour change**: on the map route the document no longer rubber-bands or hides the
  browser address bar on scroll gestures. Intentional, and the point of the issue.
- **Tests**: one new `test/core/composables/use-scroll-lock.test.ts`. The fix itself is not
  observable in happy-dom; a device pass covers it (task 6.2).
- **i18n**: none — no user-facing copy.
- **Data / DB / Worker**: none. No migration, no `wrangler deploy`.
- **Risk**: low. The lock mechanism is already shipping in production for the onboarding
  tour on both routes; this widens when it applies and moves where it lives. Main
  regression surface is the tour on the calendar route, which must keep locking — covered
  by keeping `calendar-page.vue` on the same (renamed) class.
