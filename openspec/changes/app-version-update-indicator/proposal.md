## Why

The `notif_push_enabled` drop showed that users can stay on an old build indefinitely: updates are prompt-based and the only prompt is a dismissible banner. Users (and the owner, when supporting them) can't see which version they run, and once the banner is dismissed nothing reminds them that an update is waiting.

## What Changes

- The profile overview shows the running app version in light gray text at its bottom (previews append the short commit, local builds "dev").
- While a newer build is available but not applied, the profile overview shows an update notice with the banner's update button as its first row, regardless of whether the banner was dismissed.
- While an update is pending, the profile item in the speed-dial menu and the speed-dial trigger show an attention dot. On the trigger the inbox count still takes precedence; the dot shows when there is no count.
- The app also checks for a newer build when it returns to the foreground (throttled to 15 min), not only on page load, so long-open PWA sessions notice updates.
- Dismissing the update banner hides it only until the next app start; it no longer clears the update state.
- The profile menu item announces "update available" to screen readers.
- Background tabs reload onto the new version when they become visible (fixes old tabs 404ing on stale lazy chunks).
- Not included: an inbox entry for available updates (future change).

## Capabilities

### New Capabilities
- `app-update`: app version display, detection of a pending update, the persistent update action in the profile, and the update attention dots.

### Modified Capabilities
<!-- none: the inbox badge requirement is unchanged (count shown, takes precedence) -->

## Impact

- **Client**: `core/composables/use-pwa-update.ts` (single registration, update vs. banner-dismissed state, foreground check, deferred reload), `core/components/update-prompt.vue`, profile overview (new `app-update-notice.vue` + `app-version-line.vue`), `features/map` overlay composable + speed-dial trigger wiring, i18n (`en`, `de-CH`), Vite `define` for the app version, optional `VITE_BUILD_COMMIT` in `core/constants/env.ts`.
- **CI**: `deploy-preview.yml` writes `VITE_BUILD_COMMIT` (PR head SHA); production workflow unchanged.
- **Guided tour**: no new step; walk it with and without a pending update.
- No DB, Worker or dependency changes.
