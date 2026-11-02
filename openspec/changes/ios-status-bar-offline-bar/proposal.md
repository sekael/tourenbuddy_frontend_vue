# Proposal

## Why

On the owner's iPhone 17 Pro (iOS 26) the installed app has a blur over its top edge that eats into
the header, half-hiding the tour form's Save button. Since iOS 26.1, a Home Screen app with the
`black-translucent` status bar gets that system blur, and the page cannot remove it. Offline, the
persistent offline chip and the pending-sync chip float at the bottom left over whatever is there:
the form's activity chips, the map's legend button, the track-drawing panel's buttons.

## What Changes

- **Opaque iOS status bar**: drop `apple-mobile-web-app-status-bar-style="black-translucent"`. iOS
  then draws an opaque status bar in the theme color (white) with the page below it, and the blur
  is gone. iOS reads the tag at install time: an installed copy changes once it is re-added to the
  Home Screen.
- **Offline bar**: the floating offline chip, its "you're offline" snackbar and the pending-sync
  chip become one slim bar at the top: "Offline · showing saved data", "Offline · 2 changes waiting
  to sync", or, back online, "2 changes waiting to sync" until they have synced. The bar takes its
  own band — it widens `--safe-top`, so every surface that clears the top clears the bar — and the
  band opens and closes smoothly. When the queue has drained, a brief "2 changes synced" toast
  confirms it.
- The desktop side drawer and the collapsed dialog clear the bar too (they started at the very top).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pwa-support`: the iOS status bar is opaque; pages start below it.
- `offline-data-cache`: the offline state shows in a bar with its own band at the top.
- `offline-write-sync`: the pending count lives in that bar instead of a chip.
- `design-system`: no more glass status chips among the map controls.

## Impact

- `index.html`, `src/app/theme/safe-area.css`, `src/core/components/offline-indicator.vue`,
  `offline-sync-status.vue`, `side-drawer.vue`, `dialog-window.vue`, locales.
- Installed iOS copies keep the old status bar until re-added to the Home Screen.
- The dead-letter banner (changes that couldn't sync) stays at the bottom left; it is rare and
  dismissable by review.
