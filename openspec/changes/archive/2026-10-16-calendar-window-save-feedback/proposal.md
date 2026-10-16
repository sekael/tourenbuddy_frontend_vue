# Proposal

## Why

Issue #321: in the calendar sync settings, the availability-window "Save" button is always enabled and gives no feedback — after tapping it nothing visibly changes, so users cannot tell whether their settings were applied or whether there was anything to save.

## What Changes

- The window "Save" button is disabled while the form matches the saved settings and enabled only when the user has changed a value.
- While saving, the button shows a "Saving…" state.
- After a successful save, the button shows a success-styled "Saved" confirmation with a check icon (announced to screen readers) until the user edits the form again.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `calendar-sync`: adds a requirement for dirty-state gating and save confirmation of the availability-window form.

## Impact

- `src/features/calendar/presentation/components/calendar-sync-settings.vue`
- `src/locales/en.json`, `src/locales/de-CH.json` (`calendar.sync.savingWindow`, `calendar.sync.savedWindow`)
- New test `test/features/calendar/presentation/components/calendar-sync-settings.test.ts`
- No store, DB or Worker changes.
