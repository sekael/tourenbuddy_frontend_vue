## Why

On desktop/iPad viewports (≥600px), feedback, user profile, contacts, and add-location overlays still render as bottom-anchored sheets. The existing `responsive-overlay` spec calls for a centered dialog on desktop, but the `BottomSheet` implementation and map-page container force bottom positioning regardless of viewport — so desktop users get a mobile UI glued to the bottom edge. We also lack a unified single-overlay policy that covers the tour-creation dialog and the tour-info side drawer together.

## What Changes

- Introduce a new `DialogWindow` core component: centered modal, backdrop with blur, fade-scale transition, matching current design tokens.
- Update `BottomSheet` consumers (feedback, user profile, contacts list) to render via a single adaptive overlay that:
  - ≥600px → `DialogWindow`
  - <600px → existing `BottomSheet` (unchanged)
- Refactor `TourCreationDialog` ("add new location" flow) to use `DialogWindow` and participate in the single-overlay policy.
- Extend the single-active-overlay policy on desktop to cover: all dialog windows, the tour-creation dialog, AND the tour-info `SideDrawer`. Opening any one SHALL close the currently open one.
- Mobile policy unchanged: still one bottom sheet at a time; `TourCreationDialog` bottom-anchored behavior preserved.
- Map-page `.sheet-container` positioning adapts to viewport so desktop content is centered and not bottom-pinned.
- **BREAKING** (internal only): `FeedbackSheet`, `UserProfileSheet`, `ContactsListSheet` root wrapper swapped from `BottomSheet` to adaptive overlay — slot API unchanged.

## Capabilities

### New Capabilities

- `dialog-window`: Centered modal dialog primitive for desktop viewports with backdrop, blur, fade-scale animation, close button, and title.

### Modified Capabilities

- `responsive-overlay`: Strengthen desktop behavior — feedback/profile/contacts/tour-creation MUST render as `DialogWindow` on ≥600px (not a repositioned `BottomSheet`). Single-overlay policy extended to cover `DialogWindow` + `SideDrawer` simultaneously on desktop.

## Impact

- Code: `src/core/components/` (new `dialog-window.vue`, adapt `bottom-sheet.vue` or add adaptive wrapper), `src/core/components/feedback-sheet.vue`, `src/features/user/presentation/components/user-profile-sheet.vue`, `src/features/contacts/presentation/components/contacts-list-sheet.vue`, `src/features/tours/presentation/components/tour-creation-dialog.vue`, `src/features/map/presentation/pages/map-page.vue`.
- Tests: overlay component tests + map-page integration tests.
- No backend/API/dependency changes.
- No data migration.
