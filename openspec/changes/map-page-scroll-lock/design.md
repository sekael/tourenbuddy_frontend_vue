## Context

### What actually scrolls

Three nested things are easy to conflate here:

| layer | today | scrollable? |
|---|---|---|
| `<html>` / `<body>` | `height: 100%` (`global.css:13-17`), `#app { min-height: 100lvh }` (`:38`) | **yes** — `100lvh` exceeds the visual viewport whenever browser chrome is shown |
| `.map-page` | `position: fixed; inset: 0; overflow: hidden` (`map-page.vue:927`) | no |
| MapLibre canvas | own gesture handlers | drag/pinch/rotate only |

The page was already pinned in a previous fix (the comment at `map-page.vue:921-926`
records why `fixed` replaced `relative + 100lvh`). What that fix could not reach is the
document *behind* it. `position: fixed` takes the element out of flow; it does not remove
the document's own scrollable overflow, which `#app`'s `min-height` keeps creating on
every route.

So a touch that lands on a sheet, the action bar, or the picker's button row — anything
that is not the map canvas — scrolls the document. On iOS that is momentum + rubber-band
+ address-bar collapse. The map canvas is painted inside `.map-page`, which is fixed to
the *layout* viewport, not the visual one, so it translates on screen while MapLibre's
camera state does not change. `getCrosshairCoordinates` (`location-picker.vue:32`)
unprojects the canvas centre — correct against a canvas that has not moved, wrong against
one the browser has slid. Hence "the picker moves the map".

### Prior art in this repo

The onboarding tour has exactly this bug (viewport-fixed spotlights drifting off their
targets) and already fixes it:

```css
html.tour-scroll-locked,
html.tour-scroll-locked body { overflow: hidden; overscroll-behavior: none; touch-action: none; }
html.tour-scroll-locked body { position: fixed; inset: 0; }
```

`onboarding-tour.css:11-21`. The `body { position: fixed }` half is load-bearing and the
comment says why: on iOS `overflow: hidden` alone does not stop momentum / rubber-band /
address-bar scroll. Toggled from two places with duplicated teardown:

- `map-page.vue:337-343` (watch, `immediate`) + `:353` (`onUnmounted` removal)
- `calendar-page.vue:220-224` (watch, `immediate`) + `:241` (`onUnmounted` removal)

and read by one component selector, `seasons-gantt.vue:224`.

The mechanism is proven in production on both routes. This change does not invent a lock;
it widens the condition (whole map route, not just the tour) and re-homes the rule.

## Goals / Non-Goals

**Goals**

- The document never scrolls while the map route is mounted, under any input, on iOS
  Safari / iOS PWA and by construction on every other engine.
- Scrolling a bottom sheet, dialog, or drawer never reaches the map.
- Other routes keep scrolling normally the moment the map route is left.
- The onboarding tour keeps its lock on the calendar route, unchanged in behaviour.
- Fewer lines after the change than before, in the pages.

**Non-Goals**

- Freezing scroll inside sheets while picking (see D4).
- Touching MapLibre gesture handling, the picker's coordinate maths, or `#app`'s
  `min-height: 100lvh` (that floor is load-bearing for safe areas on scrollable routes).
- A general "page declares whether it scrolls" routing convention. Two consumers, one
  composable, no route-meta indirection.

## Decisions

### D1 — Lock the whole map route, not just `isPickingLocation`

The issue asks for both ("picker must not scroll" **and** "map page should never be
scrollable"), and a permanent lock is strictly simpler than a conditional one: no watch,
no enter/leave races between the lock and the picker's own mount, and no state where the
map page scrolls for reasons the user has no way to predict. There is nothing on the map
route that wants document scroll — every overlay scrolls internally.

Consequence: `map-page.vue`'s `tourLockActive` watch becomes unreachable-by-effect and is
deleted. The route is already locked when the tour starts.

### D2 — One composable, refcounted, class name `scroll-locked`

`useScrollLock(active?)` in `src/core/composables/`:

- no argument → locked for the owner's mounted lifetime (map page)
- getter/ref argument → follows it (calendar page's tour lock)
- releases on `onUnmounted` in both shapes — today that cleanup is copy-pasted in two pages

A composable rather than two inline `classList` toggles, and rather than route meta: the
two pages want different shapes (lifetime vs. reactive), which route meta cannot express
without keeping a second mechanism for the calendar; and a refcount split across two
hand-rolled call sites is arithmetic with two owners.

**Refcounted** (module-level counter, class present while `> 0`). The obvious
justification — two pages holding the lock at once during a route swap — **does not
apply**: `patch()` in `runtime-core.cjs.js:5376-5379` unmounts the old vnode *before*
mounting the new one, and `App.vue:25` is a bare `<RouterView>` with no `<Transition>` to
defer that unmount. Two holders never coexist today. The counter is kept for the
asymmetry of the failure instead: a lock released by a leaving page that a staying page
still needs is invisible in JSDOM-class test environments (no rubber-band to observe) and
resurfaces only as #247 on a device, whereas the counter costs three lines and holds if
anyone later wraps `<RouterView>` in a `<Transition>` — which is exactly the change that
inverts the unmount/mount order.

Class renamed `tour-scroll-locked` → `scroll-locked`, and the rule moves to
`app/theme/global.css`. `onboarding-tour.css` is imported at module scope from
`use-onboarding-tour.ts:8`, so today the map route's lock rule only exists because the
page happens to import the onboarding composable. That is an accident to remove, not to
depend on; `global.css` is imported from `main.ts:17` unconditionally.

### D3 — The shared rule does NOT carry `touch-action: none`

The tour's rule sets `touch-action: none` on `html, body`. The shared rule drops it and
keeps only `overflow: hidden` + `overscroll-behavior: none` on `html, body` plus
`body { position: fixed; inset: 0 }`.

Why it was in the tour rule at all is unverifiable from the outside, and the tour cannot
have depended on it: the tour additionally makes the whole page subtree
`pointer-events: none` (`map-page.vue:940-943`) *and* sets `touch-action: none` on that
same subtree (`:942`). So the `html, body` copy has never been exercised against a live,
scrollable sheet. Carrying it into an always-on route lock would be the first time it
mattered — on the one route that must keep both sheet scrolling and map gestures alive.

What actually stops document scroll is the pin: `overflow: hidden` for the scrollable
overflow, `body { position: fixed }` for iOS momentum / rubber-band / address-bar. The
`touch-action` line is belt-and-braces that buys nothing here and costs an unknown, so it
goes.

Two facts make this safe rather than merely cheaper:

- **Map gestures are governed below us.** `maplibre-gl.css` sets `touch-action: none` on
  `.maplibregl-canvas-container` (and the canvas) whenever drag-pan and touch-zoom-rotate
  are both enabled, which is the default here. That is the nearest ancestor of any touch
  on the map, and MapLibre drives its camera from raw pointer/wheel events with
  `preventDefault()` — it never consumes document scroll. Wheel-zoom, pinch, drag and
  rotate on the visible map therefore behave identically locked or unlocked, including
  while a side drawer or bottom sheet is open over part of the map (a stated requirement —
  see the `map-integration` delta).
- **Sheet scrolling is governed by the scroll container.** The effective `touch-action` is
  intersected from the hit element up to the nearest scrolling ancestor; a touch starting
  inside `.content` (`bottom-sheet.vue:436`) stops there. With `none` removed from
  `html, body` the question does not even need to be litigated per engine.

Nothing else in the change alters gesture handling, so the device pass (task 6.2) confirms
this rather than gates it.

### D4 — Contain sheet scroll; do not freeze it

The reported symptom is document rubber-band, so the pin is the fix. `overscroll-behavior:
contain` on the core **modal** scroll containers — `bottom-sheet.vue:436`,
`dialog-window.vue:159`, `side-drawer.vue:154` — is the second half of the guarantee: a
scroll that reaches the end of a sheet stops there instead of chaining outward.

Modal surfaces only. `full-screen-page.vue:129` is excluded: it is a page, not a layer over
scrollable content, so it has nothing to chain into. On the map route the containment is
belt-and-braces (the pinned document cannot scroll anyway); it earns its place on the other
routes, where a document still scrolls behind an open dialog or drawer.

Because the CSS ships to three components, the contract is specced for all three
(`bottom-sheet`, `dialog-window`, `side-drawer` deltas) — shipping behaviour to two
capabilities while documenting one is how specs rot.

Rejected: hard-freezing sheet scroll while `isPickingLocation`. It does not address the
reported symptom (a frozen sheet does not stop the *document* bouncing), and it has a real
cost — the info sheet's edit form is `overflow-y: auto` and taller than the sheet
(`tour-form.vue:1059`), so a user picking a start point would be unable to scroll to the
field the pick is about to fill. The picker already suspends those surfaces
(collapsed header, inputs disabled — `map-integration` spec, "Suspends an open tour edit
surface while picking"); reading them must stay possible.

`contain` not `none`: `none` also disables the element's own rubber-band, which is a
platform affordance inside a scroll region and costs us nothing to keep.

### D5 — No scroll-position save/restore

Pinning `body { position: fixed }` resets the document scroll offset to 0, and releasing it
does not restore. Irrelevant here: the lock is taken on route *entry*, and a route change
starts at offset 0 anyway. Worth noting explicitly because it is the classic bug in
body-scroll-lock implementations, and the reason this change must not be reused as-is for
a modal-over-a-scrolled-page lock later.

### D6 — One test, on the refcount only

Nothing this change *does* is observable in happy-dom: no viewport, no rubber-band, no
compositor. A component test could only assert that a class string is present, i.e. that
the call site was written — which the diff already shows. So the map-page test is dropped
and the device pass (task 6.2) is the real proof of the fix.

The exception is the counter. Its failure modes are arithmetic, not visual: a double
decrement leaves the app unscrollable on every route, a premature release restores #247 —
and neither is visible on the map route itself, where the lock holds for other reasons.
Exactly one test covers the double-mount / single-unmount ordering. No suite, no fixtures,
no component mount.

## Risks / Trade-offs

- **Address bar can no longer be dismissed by scrolling on the map route.** Intended: the
  map already fills `100lvh` and the action bar / picker buttons are `position: fixed` with
  `--safe-bottom` (`location-picker.vue:78`), so nothing is stranded behind chrome.
- **Class rename touches the calendar tour**, which is currently green. Both toggle sites
  and the one selector (`seasons-gantt.vue:224`) change together; a missed site is a silent
  tour regression, so the rename is grep-verified in task 6.1.
- **Refcount leak** would leave the app permanently unscrollable, and on a route that is
  not the one being changed. Contained by the composable owning both increment and
  decrement in mount/unmount pairs, with no public release API, plus the single test in D6.
- **No automated coverage of the actual behaviour.** Accepted: the environment cannot
  provide it. The device pass is a checklist item, not a CI gate, so a future regression
  here will be caught by a human or not at all — which is the same position the onboarding
  tour's lock has been in since it shipped.

## Migration Plan

None — presentation-only, no data, no schema, no Worker. Ships in one PR.

## Open Questions

None. Every branch was resolved in review: targeted lock over changing `#app`'s
`min-height` (D1), refcount kept despite the unmount-order evidence (D2),
`touch-action: none` dropped from the shared rule (D3), containment narrowed to modal
surfaces (D4), and coverage reduced to the refcount test (D6).
