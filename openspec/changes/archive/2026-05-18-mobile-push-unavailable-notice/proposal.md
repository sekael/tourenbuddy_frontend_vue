## Why

On mobile viewports, the inline notice in the user profile that explains why push notifications are unavailable (PWA not installed, or permission denied) renders as a long wrapped paragraph — especially in German — and breaks the visual rhythm of the notifications row (issue #151). Users need the same information in a compact, mobile-friendly form.

## What Changes

- Replace the inline `installHint` / `deniedHint` row text with a compact "Not available" badge plus an info icon button in `notification-preferences-section.vue`.
- Tapping the info icon shows the full explanation via the existing touch-aware `base-tooltip` component.
- Add a new i18n key `notifications.pushUnavailable` ("Not available" / "Nicht verfügbar") to `en.json` and `de-CH.json`.
- Reuse existing `notifications.installHint` and `notifications.deniedHint` strings unchanged as tooltip bodies.
- Update notifications spec to describe the compact-unavailable presentation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `notifications`: presentation rule for the push-notifications row when push is unavailable (PWA install required or permission denied) changes from inline hint text to a compact unavailable badge with an info-icon-triggered tooltip carrying the full explanation.

## Impact

- Code: `src/features/notifications/presentation/components/notification-preferences-section.vue` (template + scoped styles).
- i18n: `src/locales/en.json`, `src/locales/de-CH.json` — new `notifications.pushUnavailable` key.
- Reuse: `src/core/components/base-tooltip.vue` (no change expected).
- Tests: `test/features/notifications/presentation/components/notification-preferences-section.spec.ts` (or equivalent) covering both unavailable states.
- No API, store, or DB changes. No breaking changes.
