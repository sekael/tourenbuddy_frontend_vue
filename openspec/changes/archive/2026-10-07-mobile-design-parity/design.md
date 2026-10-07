# Design

## D1 — Exit animation for owner-unmounted surfaces

`<Transition>` only plays a leave while it stays mounted (verified: a teleported child inside a Transition is removed immediately when its owner unmounts). The sheet ⇄ page swaps happen by the owner swapping components, so a Transition cannot cover them without restructuring every consumer.

`useExitAnimation(el, keyframes)`: capture the node, parent and next sibling in `onBeforeUnmount` (Vue nulls template refs while unmounting); in `onUnmounted`, if the node is detached and its parent is still in the document, re-insert it `inert`, `pointer-events: none`, `data-exiting`, run the keyframes with WAAPI and remove it on `finished`. If the node is still connected, an ancestor's leave transition (map page `sheet` / `sheet-swap`) owns it — do nothing. If the parent is gone, do nothing.

- Re-inserting restarts CSS keyframes; `[data-exiting] { animation: none }` stops entrances replaying.
- Keyframes read tokens from the node (`--motion-*`), so reduced motion applies.
- *Alternatives:* restructure `AdaptiveOverlay` so the Teleport + Transition stay mounted (does not cover `TourInfoSheet`'s `<component :is>` nor full close); `<dialog>.showModal()` top layer (would stack above snackbars and the guided tour).

Result: sheet → page = sheet fades (short) while page rises in (medium) — a fade-through; page → sheet = page fades over the returning sheet; closing from a page fades it.

## D2 — Sheet fits content like `DialogWindow`

Slot wrapped in `.content-body` (natural height). Fitted height = `sheet.offsetHeight − content.clientHeight + content padding + body height`, capped at 70% of the visible viewport — computed without resetting the inline height, so it can glide. A ResizeObserver on header, handle and body refits; the first size lands without a glide (two rAFs), later ones glide (`--motion-duration-medium`, emphasized).

Fit-content sheets open at `min(natural, 70%)`. If the content (measured without the handle, so showing the handle cannot flip the decision) is taller than that, the sheet shows a drag handle with three detents: peek, opening height, `min(natural, 90%)`. Content that fits shows no handle and has the single resting height. A sheet parked at peek is not reopened by content changes; when content shrinks so the handle goes away, the sheet returns to its resting height.

## D3 — Viewport and flick

`useWindowSize()` makes snap heights reactive. Flick: velocity of the last pointer move; if the finger rested > 100 ms before lifting it is ignored; > 0.5 px/ms moves to the next snap in that direction, otherwise nearest snap as before.

## D4 — Shared sheet hosts

`.sheet-host` (fixed bottom, pass-through, `display: contents` ≥ 600px) + global `sheet` transition; `.sheet-host--modal` adds scrim + mount keyframes (scrim fades, child rises) and uses `useExitAnimation(host, fadeOut)` for the exit. Consumers keep only their z-index.

## D5 — Touch

Hover fills are a pointer affordance: `@media (hover: hover)` around each `:hover` rule, plus an identical `:active` rule so touch shows the same fill while pressed (explicit later `:active` rules still win). Mechanical transform — no selector semantics changed.

## D6 — Toasts above sheets

`useSheetInset()` keeps a module-level map of open sheets' heights (ResizeObserver on the sheet) and publishes the max as `--sheet-inset` on `<html>`; `--float-bottom = max(xl + safe-bottom, sheet-inset + md)` (and a corner variant). Without a sheet the values equal today's.

## D7 — Guided tour: finishing mid-staging

`stage` is async and kept navigating after "Finish tour" (`spotlight` returned silently once the tour ended), so the next `openMenu()` / `openOverlay('contacts')` ran after cleanup. Each staging run now carries a token (bumped on start and teardown); `ctx.spotlight` throws `TourEnded` once its run is dead, `goToStep` swallows it and re-checks before calling `stage`. A new `onDismissed` hook (early finish only, not route-leave or completion) lets the map page reopen the overlay that was open when the tour started (profile for "Show app tour"; stateful overlays — tour, creation, offline download — are not restored).

## Risks

- [Ghost node keeps old DOM for ~200 ms] → inert, no pointer events, removed on finish; no reactivity (instance already unmounted).
- [Content-following sheets move while content loads] → one emphasized glide per change, same as desktop dialogs; the guided tour waits for 5 stable frames before spotlighting.
- [Status bar] unchanged; flagged for device verification.
