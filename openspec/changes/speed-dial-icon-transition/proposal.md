## Why

Speed dial trigger uses a static `add` icon that rotates 45° to imply close — this is ambiguous. Replacing with explicit `menu` / `close` icons with a fade transition makes the closed/open states unambiguous at a glance.

## What Changes

- Replace single `add` icon with two icons (`menu` when closed, `close` when opened)
- Icon swap uses a CSS fade transition (opacity cross-fade) instead of the existing rotation
- Remove the `transform: rotate(45deg)` style that was previously applied to the icon

## Capabilities

### New Capabilities

- `speed-dial-icon-transition`: Fade-transition between `menu` and `close` Material Symbols icons in the speed dial trigger based on open/closed state

### Modified Capabilities

<!-- none -->

## Impact

- Single file: `src/features/map/presentation/components/speed-dial-trigger.vue`
- No prop, emit, or store changes
- No i18n changes needed
