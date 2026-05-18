## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b fix/155-scrollbar-gutter-overlays`

## 2. Bottom Sheet

- [x] 2.1 In `src/core/components/bottom-sheet.vue`, update `.content` style: add `scrollbar-gutter: stable`, `scrollbar-width: thin`, `scrollbar-color: var(--color-outline-variant) transparent`, and `padding-right: var(--spacing-xs)`.
- [x] 2.2 Add `::-webkit-scrollbar { width: 6px }` and matching `::-webkit-scrollbar-thumb` styling for `.content` (mirror `dialog-window` thumb style for consistency).

## 3. Dialog Window

- [x] 3.1 In `src/core/components/dialog-window.vue`, add `scrollbar-gutter: stable` and `padding-right: var(--spacing-xs)` to `.dialog-content` (thin styling already present).

## 4. Side Drawer

- [x] 4.1 In `src/core/components/side-drawer.vue`, update the scroll region (the `overflow-y: auto` block around line 184) with `scrollbar-gutter: stable`, `scrollbar-width: thin`, `scrollbar-color: var(--color-outline-variant) transparent`, `padding-right: var(--spacing-xs)`, and matching `::-webkit-scrollbar` thin styling.

## 5. Manual Verification

- [ ] 5.1 Open user profile sheet on mobile viewport (DevTools) — scroll, confirm scrollbar does not overlap any text/button/toggle.
- [ ] 5.2 Repeat on desktop viewport (DialogWindow path).
- [ ] 5.3 Verify tour info sheet (long content) on mobile + desktop.
- [ ] 5.4 Verify contacts side drawer (long list) on desktop.
- [ ] 5.5 Confirm no horizontal layout shift when content transitions from non-scrollable to scrollable on desktop.

## 6. Finalize

- [x] 6.1 Run `npx eslint . --fix` — zero warnings.
- [x] 6.2 Run `npm run type-check`.
- [x] 6.3 Run `npm run test`.
- [ ] 6.4 Prompt user to commit with conventional message: `fix(ui): reserve scrollbar gutter in overlays so scrollbar never overlaps content (#155)`.
- [ ] 6.5 Prompt user to push branch and open PR against `main`, linking issue #155.
