## Why

During the closed beta we need a low-friction path for users to report bugs and suggest features without leaving the map context. The Flutter app already exposes this via a feedback button on the map page; the Vue rewrite is missing parity, which means beta testers on web have no in-app channel to file issues.

## What Changes

- Add a Feedback floating action button (FAB) to the map action overlay on the map page.
- Tapping the FAB opens a bottom sheet offering a primary action that opens the GitHub `bug_report.md` issue template in a new tab, plus a fallback hint pointing to `feedback@tourenbuddy.ch`.
- If the new tab cannot be opened (e.g. popup blocked), surface the failure via the existing `useSnackbar` composable.
- Extract the GitHub issue URL and feedback email to `src/core/constants/feedback.ts` so they are not hardcoded inside components.
- Introduce a reusable `FeedbackSheet` component under `src/core/components/` so other surfaces can reuse it later and `map-action-overlay.vue` stays under the 150-line limit.
- `map-action-overlay.vue` only emits `openFeedback`; `map-page.vue` owns sheet visibility, mirroring how the profile and contact sheets are wired today.

## Capabilities

### New Capabilities

- `user-feedback`: In-app entry point for beta users to file GitHub issues or contact the team via email from the map screen.

### Modified Capabilities

- `map-integration`: Map action overlay gains a new feedback FAB and a corresponding `openFeedback` event consumed by the map page.

## Impact

- **Code**:
  - New: `src/core/constants/feedback.ts`, `src/core/components/feedback-sheet.vue`, `test/core/components/feedback-sheet.spec.ts`
  - Modified: `src/features/map/presentation/components/map-action-overlay.vue`, `src/features/map/presentation/pages/map-page.vue`
- **Dependencies**: None new. Reuses `useSnackbar`, `useLogger`, existing design tokens.
- **External**: Links to `https://github.com/sekael/tourenbuddy_frontend_vue/issues/new?template=bug_report.md` (already present in `.github/ISSUE_TEMPLATE/`).
- **Tests**: New component test for `FeedbackSheet`. No backend or schema changes.
