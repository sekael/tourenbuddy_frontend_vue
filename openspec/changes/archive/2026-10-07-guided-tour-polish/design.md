# Design

## Context

driver.js 1.4: `highlight()` on a live instance tweens the stage (400 ms, fixed) from the cached stage rect to the new element's live rect. A popover passed in the same call is rendered at the tween midpoint and never re-placed; highlighting the *same* element again renders it immediately. Its state is a module singleton shared by all `driver()` instances. Window scroll/resize re-measure the active element — a detached node measures as a zero rect at (0,0).

## Decisions

### D1 — One driver per run, glide between targets
`ensureDriver()` creates the driver on the first highlight; `moveTo(el, popover?)` fades the old popover, highlights `el` (glide), waits for `max(glideMs, target stable)` and only then highlights `el` again with the popover. Replaces the destroy → 500 ms → recreate cycle. *Alternative:* keep re-creating but cross-fade the overlay — still flashes the full-screen dim on every move.

### D2 — Park on a fixed anchor while surfaces change
A single module-level `div.onboarding-tour-anchor` (fixed, hidden, no pointer events). `park(true)` collapses the cutout to a point at the last rect's centre before `stage` runs; `park(false)` freezes it in place after a waypoint's hold, before the host actuates (and usually unmounts) that control. The next `moveTo` glides out of the anchor. Avoids measuring detached nodes and reads as one continuous "iris" motion.

### D3 — Stage only on surface change, pass `from`
The composable tracks `stagedSurface` (reset on teardown and while a stage is in flight). Same surface → no stage call. Different → `stage(surface, ctx, from)`. Hosts use `from` for shortest paths; any unknown `from` (null) still replays from a clean slate, so back-navigation and resume stay deterministic.

### D4 — Animated release, flushed on restart
`releaseDriver()` adds `body.onboarding-tour-leaving` (CSS fades overlay + popover) and destroys after `fadeMs`. The destroy closure is kept in a module-level `pendingDestroy`; `ensureDriver()` / `releaseDriver()` flush it first so the map → calendar hand-off or a quick replay never has its fresh state wiped.

### D5 — Step order follows surfaces
Steps that share a surface are adjacent (profile ×3, tours ×2, menu → base-map), so most transitions are a glide. The map tour opens on the core action (no navigation) and ends on the calendar entry that the completion hand-off follows.

### D6 — Reduced motion
`prefers-reduced-motion: reduce` → driver `animate: false`, `glideMs`/`fadeMs` 0, instant scroll; CSS drops the rise/halo keyframes.

## Risks

- Smooth `scrollIntoView` inside a sheet: the stability check could pass before the scroll starts → a 60 ms head start before `waitForPosition`, and `refreshAfterMotion` re-anchors if the target still drifts.
- Resume index semantics change with the new order (clamped; worst case the user resumes on a neighbouring step).
