## 1. Constants

- [x] 1.1 Create `src/core/constants/feedback.ts` exporting `FEEDBACK_GITHUB_ISSUE_URL` and `FEEDBACK_EMAIL` with JSDoc comments

## 2. Reusable FeedbackSheet component

- [x] 2.1 Create `src/core/components/feedback-sheet.vue` (`<script setup lang="ts">`) with a `close` emit
- [x] 2.2 Render a bottom-sheet layout: primary "Open Issue on GitHub" button + email fallback hint, using design tokens (`var(--spacing-*)`, `var(--color-*)`, `var(--radius-*)`)
- [x] 2.3 Implement `openIssue()` that calls `window.open(FEEDBACK_GITHUB_ISSUE_URL, '_blank', 'noopener,noreferrer')`, logs via `useLogger('feedback-sheet')`, emits `close` on success, and on `null` return calls `useSnackbar().showError(...)` pointing the user to the email fallback
- [x] 2.4 Render `feedback@tourenbuddy.ch` as a `mailto:` link sourced from the constants module
- [x] 2.5 Verify the component file stays under 150 lines

## 3. Map overlay wiring

- [x] 3.1 Add a Feedback FAB to `src/features/map/presentation/components/map-action-overlay.vue` using the `feedback` material symbol
- [x] 3.2 Add `openFeedback: []` to the overlay's `defineEmits` and emit it from the FAB click handler
- [x] 3.3 Confirm the overlay still fits under 150 lines and contains no sheet state

## 4. Map page wiring

- [x] 4.1 In `src/features/map/presentation/pages/map-page.vue`, add a `showFeedbackSheet` ref and an `@open-feedback` listener on `<MapActionOverlay>`
- [x] 4.2 Render `<FeedbackSheet>` inside a `<Transition name="sheet">` block mirroring the existing profile/contact sheet wiring, closing on the sheet's `close` event

## 5. Tests

- [x] 5.1 Create `test/core/components/feedback-sheet.spec.ts`
- [x] 5.2 Test: clicking the primary button calls `window.open` with `FEEDBACK_GITHUB_ISSUE_URL` and `'_blank', 'noopener,noreferrer'`, then emits `close`
- [x] 5.3 Test: when stubbed `window.open` returns `null`, the snackbar `showError` is invoked and the sheet does not emit `close`
- [x] 5.4 Test: the rendered email link uses `FEEDBACK_EMAIL` from the constants module

## 6. Quality gates

- [x] 6.1 Run `npm run lint` — zero warnings
- [x] 6.2 Run `npm run format`
- [x] 6.3 Run `npm run type-check`
- [x] 6.4 Run `npm run test` — all tests pass
- [x] 6.5 Manual smoke test: open map page, click Feedback FAB, confirm sheet appears and link opens GitHub issue template in a new tab

## 7. Commit

- [x] 7.1 Atomic commit `feat(map): add feedback entry point on map screen`
