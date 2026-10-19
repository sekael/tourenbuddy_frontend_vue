# Proposal

## Why

On mobile (<600px), picking a location from a tour form (start, end or goal) wipes the user's unsaved edits — partners, activity type, dates, notes — leaving only values the map page holds itself, such as the goal (issue #337). The form surface swaps from the full-screen page to a collapsed bottom sheet for the pick, and that swap rebuilds the form from scratch. Tour edit and suggest lose edits the same way.

## What Changes

- On mobile, a location pick started from a full-screen data-entry page collapses **that page** to a title-only bar at the bottom of the screen instead of switching to a collapsed bottom sheet. The form stays alive underneath, so every unsaved field survives the pick.
- Applies to all three tour form flows: create, edit and suggest.
- The collapsed page bar looks and sits like the collapsed bottom sheet does today (bottom-anchored, title naming the pick type, no close/Save), so the location picker's Cancel/Continue buttons keep their position.
- Desktop is unchanged (the dialog / side drawer already keep the form mounted while collapsed).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bottom-sheet`: "Data entry uses a full-screen page on mobile" — a pick that needs the map collapses the full-screen page in place instead of falling back to the collapsed bottom sheet.
- `tour-form-extended`: new requirement — a location pick preserves every unsaved form field.

## Impact

- `src/core/components/full-screen-page.vue` (new `collapsed` mode), `src/core/components/adaptive-overlay.vue` (forwards `collapsed` to the page).
- `src/features/tours/presentation/components/tour-creation-dialog.vue`, `tour-info-sheet.vue` (stay in page mode during a pick).
- Tests: `test/core/components/`, `test/features/tours/presentation/components/`.
- No DB, API or i18n changes. Onboarding tour does not stage a location pick, so its targets are unaffected.
