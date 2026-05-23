## 1. Git Setup

- [x] 1.1 Create branch from latest `main`:
  ```bash
  git fetch origin && git checkout main && git pull && git checkout -b feat/176-pwa-status-bar-fade
  ```

## 2. Global CSS foundation

- [x] 2.1 In `src/app/theme/global.css`, change `body { background-color: var(--color-status-bar) }` → `background-color: transparent`; add comment explaining pages own the safe-area.
- [x] 2.2 In `src/app/theme/global.css`, give `#app` a base `min-height: -webkit-fill-available; min-height: 100dvh;` so a page without explicit root sizing still fills the viewport.
- [x] 2.3 Apply a neutral fallback background on `html` (`background-color: var(--color-background)`) so brief unmounted states show surface color, not blue.
- [x] 2.4 (Optional) Demote `--color-status-bar` to a single comment-documented fallback or remove it if unused after audit (`grep -rn 'color-status-bar' src`).

## 3. Page root pattern

- [x] 3.1 Audit pages under `src/features/*/presentation/pages/*.vue` (`home-page`, `email-entry-page`, `verify-otp-page`, `onboarding-page`, `map-page`, plus any other routed pages discovered in `src/app/router/index.ts`).
- [x] 3.2 For each page root: replace `min-height: 100vh` with `min-height: -webkit-fill-available;` followed by `min-height: 100dvh;`; remove any `padding-top` that creates a non-image gap above the notch.
- [x] 3.3 For home page (`home-page.vue`), confirm `.background` `picture` and `.overlay` use `inset: 0` (already does) so they paint behind notch.
- [x] 3.4 For each page's *inner content* container (where headings/CTA live), add `padding-top: calc(var(--spacing-xl) + env(safe-area-inset-top))` so the heading stays clear of the notch.

## 4. Map view full-bleed

- [x] 4.1 Ensure the MapLibre container in `map-page.vue` sizes to `100dvh` (with `-webkit-fill-available` fallback) and has no top padding.
- [x] 4.2 Trigger `map.resize()` on mount + on `visualViewport.resize` so tile rendering accounts for dynamic-viewport changes (only if not already wired).
- [x] 4.3 Audit map overlays (`src/features/map/presentation/components/map-action-overlay.vue`, `tour-action-bar.vue`, FABs, speed-dial) — add `padding-bottom: env(safe-area-inset-bottom)` OR `bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom))` so touch targets sit above Android gesture bar / iOS home indicator.

## 5. Scrollable lists & bottom sheets

- [x] 5.1 Audit any scrollable list containers (tours list, contacts list) — add `padding-bottom: env(safe-area-inset-bottom)` to the scroll wrapper so the last item is reachable above the home indicator.
- [x] 5.2 In bottom-sheet component (`src/core/components/bottom-sheet*.vue`), ensure the sheet's content area includes `padding-bottom: env(safe-area-inset-bottom)`.

## 6. Verification (automated)

- [x] 6.1 `npm run type-check` — passes.
- [x] 6.2 `npx eslint .` — zero warnings.
- [x] 6.3 `npm run test` — all unit tests pass.

## 7. Verification (manual — required per issue)

- [ ] 7.1 **iOS PWA install**: add to Home Screen on iPhone with notch (iOS 16+). Open home page → background image extends edge-to-edge, no blue band. Status-bar text legible over image.
- [ ] 7.2 **iOS PWA map**: navigate to map → Swisstopo tiles render under notch and under home indicator. Map action bar buttons clearly above home indicator.
- [ ] 7.3 **iOS PWA short content**: open a page with content that doesn't fill viewport (e.g. email-entry) → background is page surface color, not blue, all the way to top edge.
- [ ] 7.4 **Android PWA**: install on Android (Chrome → Install app). With gesture nav enabled, verify map action bar and any FAB are not covered by the gesture indicator. Background image / map tiles reach top edge.
- [ ] 7.5 **Desktop browser**: verify no visual regression (safe-area insets are 0; layout unchanged).
- [ ] 7.6 **In-browser iOS Safari (not installed)**: confirm graceful behaviour — pages still look fine, no broken bands.
- [ ] 7.7 **Scroll behaviour**: scroll home/map → no jumping or background gap re-appearing at top.
- [ ] 7.8 **Rotate device**: portrait → landscape on iOS PWA → safe-area on the left/right (landscape notch side) is filled by page background, content stays inside safe-area.

## 8. Finalize

- [ ] 8.1 `npx eslint . --fix` and `npm run type-check` clean.
- [ ] 8.2 Prompt user to commit with conventional commit message:
  ```
  fix(pwa): extend page backgrounds under iOS notch and Android gesture bar (#176)

  Body becomes transparent; page roots size to 100dvh and own their full-viewport
  background. Interactive overlays apply env(safe-area-inset-bottom) so touch
  targets stay clear of the home indicator. Closes #176.
  ```
- [ ] 8.3 Prompt user to push branch and open PR against `main` referencing #176; PR description includes the manual test plan from §7 as a checklist for the reviewer.
- [ ] 8.4 After merge, prompt user to run `openspec-archive` skill to archive this change.
