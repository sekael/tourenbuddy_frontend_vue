# Design

## D1. Opaque status bar, not a fight with the blur

iOS 26.1+ blurs the top edge of a Home Screen app whose status bar is `black-translucent` (the
"scroll edge effect"). WebKit hides it only for some fixed, opaque, full-width top containers, and
reports on what qualifies conflict (iPhone vs iPad, 26.x vs 27). Dropping the tag is the fix most
projects confirmed on iPhone: iOS draws an opaque status bar in `theme-color` and the page starts
below it, so `env(safe-area-inset-top)` becomes 0 and every `--safe-top` padding collapses on its
own. Cost: the map no longer runs under the status bar, and installed copies need re-adding to the
Home Screen (iOS reads the tag at install). Not verifiable in Chromium; the owner checks the phone.

## D2. A bar with its own band instead of floating chips

The chips floated over whatever the screen had in that corner; every surface would have had to
publish its own inset (sheets and the location picker already do) and full-screen forms have no
free corner at all. A bar at the top that widens `--safe-top` reuses what every page, sheet header,
overlay and toast at the top already honors, so it cannot cover a control anywhere. The band is a
registered custom property (`@property --offline-bar-height`) that transitions, so headers glide
down and back instead of jumping; `:root:has(.offline-bar--on)` opens it, with no JS sizing.

The bar keeps its last words while the band closes, so it doesn't empty before it has shrunk, and
it stays in the DOM as a live region so each change of state is announced.

## D3. One status line

The bar says what matters in one line that fits 360 px in German: offline with saved data, offline
with N changes waiting, or online with N still waiting to sync (until the drain finishes). The
"you're offline" snackbar is redundant with it and goes; the transient "N waiting to sync" toast on
the first queued change stays (spec), as do the blocked-action and write-error snackbars.

When the queue drains online, a brief "N changes synced" toast confirms it: the bar closing on its
own reads as nothing having happened (review round 1). It shows only if no change was dead-lettered
in that drain, and never offline (a create and delete that cancel out offline empty the queue too).
