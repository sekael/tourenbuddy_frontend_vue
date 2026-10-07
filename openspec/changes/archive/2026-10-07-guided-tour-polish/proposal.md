# Proposal

## Why

The guided tours (map + calendar, desktop + mobile/PWA) are the first thing a new user sees, and they still feel like an MVP:

- **Choppy motion.** Every step and every waypoint destroys the driver.js mask and builds a new one: the dim drops, a 500 ms pause, the dim fades back in. Waypoints hold for 2 s each. Moving between two rows of the same profile sheet replays the whole FAB → menu → sheet path (~6 s of on/off flashing).
- **Hard cuts.** The popover vanishes (`display:none`) and the tour ends in one frame; the welcome screen pops in and out with no motion.
- **Stale content.** Offline maps and calendar sync — two of the app's headline features — are not in the tour; the separate "contacts list" step only shows an empty state for a new user; the calendar tour opens on its least important step (the tab's tap-again shortcut) and the spec still lists three calendar steps while four ship.

## What Changes

- **One persistent spotlight per run.** The driver lives for the whole tour; re-highlighting glides the cutout from target to target. Popovers attach only after the glide and the target settled (two-phase reveal kept), rise in, and fade out before the spotlight moves on.
- **Parking.** While the app swaps surfaces the cutout collapses onto an invisible fixed anchor (never a node that is about to unmount), then grows out onto the next waypoint. A waypoint freezes on the anchor before it is actuated.
- **Surface reuse.** Steps on the surface already on screen skip staging; `stage(surface, ctx, from)` receives the current surface so the host takes the shortest path (open menu kept, contacts → friend requests without reopening contacts).
- **Faster pacing.** Waypoint hold 1.1 s (was 2 s + 2 × 0.5 s gaps); glide 420 ms; fades 200 ms. `prefers-reduced-motion` disables the glide and fades.
- **Soft exit.** Finishing fades overlay + popover before the driver is destroyed; a pending destroy is flushed before any new tour starts (driver.js state is module-global).
- **Look.** Popover: larger radius, layered shadow, rise-in. Waypoint hints: compact pill in the map-control colour. Banner: glass surface, animated progress line, title cross-fade, filled "next" control. Welcome: icon badge with halo, staggered rise-in, fade/scale transition, blurred backdrop on desktop; per-tour icon.
- **Map tour steps (10, grouped by surface):** plan a tour → switch the map → offline maps (new) → phone → notifications → calendar sync (new) → contacts (merged with the old contacts-list step) → friend requests → your & friends' tours → open the calendar.
- **Fix:** finishing a tour reopened from the profile returns to the profile sheet again (required by `design-system`, broken because the sheet closed itself before the tour captured its origin).
- **Calendar tour steps (4):** day chips → availability (now mentions calendar sync) → jump to today → seasonal overview.

## Non-Goals

- Changing tour behaviour: welcome actions, finish/back/next, backdrop-tap advance, resume persistence, the calendar hand-off and gates are unchanged.
- Replacing driver.js.

## Impact

- `features/onboarding`: `use-onboarding-tour.ts` (engine), `onboarding-steps.ts`, `onboarding-tour.css`, banner + welcome components.
- Hosts: `map-page.vue` (`stageTourSurface` with `from`, new `menu` surface), `calendar-page.vue` (stage + step order), `calendar-tour-steps.ts`.
- New anchor `data-tour="calendar-sync"` on the profile overview row.
- i18n: new `offlineMap` / `calendarSync` keys; removed `onboarding.tour.contacts` + `labels.contacts`.
- Persisted `onboarding_tour_last_step` indices now map to the new order; out-of-range values are clamped as before. No DB change.
