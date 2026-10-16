# Proposal

## Why

Splitting the long requirements (`split-long-spec-requirements`) surfaced spec text that no longer matches the app. When the map layers panel replaced the base-map style picker, `map-trail-overlays` gained "Map layers panel", but `map-integration` and `design-system` kept describing the old picker. `map-integration` also says the speed-dial trigger is disabled while an overlay is open, while the app — and `tour-action-bar` — let a tap on the dimmed trigger close the overlay.

## What Changes

- `map-integration`:
  - "Speed-dial entries and order" is replaced by "Speed-dial menu entries and order": the second entry is map layers, and the "Style picker button" scenario (styles unfolding beside the entry) becomes "Map layers entry" (the panel replaces the menu).
  - "Base map picker styling" (glass pills with check or `map` icons) is removed; "Map layers panel" in `map-trail-overlays` already specifies the preview tiles that replaced it.
  - "Map action overlay icons": map layers uses the `layers` icon, not `map`.
  - "Speed-dial trigger disabled while an overlay is active": a tap on the disabled-looking trigger closes the active overlay without opening the menu (matching `tour-action-bar`), and a new scenario covers the trigger being hidden while an offline region is drawn.
- `design-system`, "Documented exceptions to shared button components": the map overlay controls bullet names the current components (`map-layers-panel` with its `layer-tile` previews) instead of the removed `map-base-map-panel`.

No app behavior changes; the specs catch up with it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `map-integration`: speed-dial entries, icons, and trigger behavior corrected; obsolete base-map picker styling removed.
- `design-system`: map overlay controls exception names the current components.

## Impact

- `openspec/specs/map-integration/spec.md`, `openspec/specs/design-system/spec.md` on archive. No code changes.
