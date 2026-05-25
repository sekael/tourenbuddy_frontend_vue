## 1. Git Setup

- [x] 1.1 Sync main and branch: `git fetch origin && git checkout main && git pull && git checkout -b fix/194-ios-viewer-close`

## 2. Verify viewport meta

- [x] 2.1 Confirm `index.html` `<meta name="viewport">` includes `viewport-fit=cover`. If missing, add it (required for `env(safe-area-inset-*)` to resolve non-zero on iOS).

## 3. Safe-area CSS

- [x] 3.1 In `src/features/tours/presentation/components/tour-attachment-viewer.vue`, change `.viewer__header` padding-top to `calc(var(--spacing-md) + env(safe-area-inset-top, 0px))` while keeping current side + bottom padding.
- [x] 3.2 Add `padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px))` to `.viewer__dots`.
- [x] 3.3 Add `padding-bottom: calc(var(--spacing-xs) + env(safe-area-inset-bottom, 0px))` to `.viewer__pdf-nav`.
- [x] 3.4 Also offset side nav arrows (`.viewer__nav--prev` / `--next`) with `env(safe-area-inset-left/right, 0px)` so they don't collide with rounded-corner safe areas on landscape iPhone.

## 4. Swipe-to-close logic

- [x] 4.1 Add `touchStartY` ref alongside `touchStartX`.
- [x] 4.2 In `onTouchStart`, also capture `e.touches[0].clientY`.
- [x] 4.3 In `onTouchEnd`, compute `dx`, `dy`. If `dy > 0` AND `dy > |dx|` AND `dy >= 80`, emit `close`. Else if `|dx| > |dy|` AND `|dx| >= 40`, navigate prev/next (existing). Upward swipes (`dy < 0`) do nothing.
- [x] 4.4 Reset both refs after gesture end.

## 5. Tests

- [x] 5.1 Add `test/features/tours/presentation/components/tour-attachment-viewer.spec.ts` (or extend existing).
- [x] 5.2 Test: swipe down past 80 px emits `close`.
- [x] 5.3 Test: swipe up past 80 px does NOT emit `close` and does NOT navigate.
- [x] 5.4 Test: horizontal swipe past 40 px navigates next/prev and does NOT emit `close`.
- [x] 5.5 Test: diagonal swipe with dominant horizontal axis navigates, does not close.
- [x] 5.6 Test: short tap-like gesture (<40 px both axes) does nothing.
- [x] 5.7 Run `npm run test` — all pass.

## 6. Manual verification

- [x] 6.1 `npm run dev`, open viewer on desktop — close button + dots positioned normally (no visible shift since insets resolve to 0).
- [x] 6.2 iOS PWA (added to home screen) via preview deploy: confirm close button clears status bar AND swipe-down closes viewer AND swipe-up does NOT close.
- [x] 6.3 Android PWA (added to home screen) via preview deploy: same verifications as 6.2 — close button visible above status bar, swipe-down closes, swipe-up no-op.
- [x] 6.4 Confirm horizontal navigation still works on both touch platforms.

## 7. Finalize

- [x] 7.1 Run `npx eslint . --fix`; ensure zero warnings (`npx eslint .`).
- [x] 7.2 Run `npm run type-check`.
- [x] 7.3 Prompt user to commit with conventional message:
  ```
  fix(tours): close PWA image viewer reliably on iOS and Android (#194)

  - Honor safe-area-inset-top so close button clears system status bar (iOS + Android PWA)
  - Honor safe-area-inset-bottom on dots/PDF nav for home indicator / gesture bar
  - Honor safe-area-inset-left/right on side nav arrows for landscape
  - Add swipe-down-to-close gesture matching native Photos UX
  ```
- [x] 7.4 Prompt user to push branch and open PR against `main`.
