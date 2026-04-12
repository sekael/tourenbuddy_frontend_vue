## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/tour-info-side-drawer`

## 2. SideDrawer Component

- [x] 2.1 Create `src/core/components/side-drawer.vue` — a responsive component that renders as a right-edge drawer on desktop (>=600px) and delegates to `BottomSheet` on mobile (<600px). Fixed width 400px, full viewport height, left border, close button, slide-from-right transition on desktop.
- [x] 2.2 Create `test/core/components/side-drawer.test.ts` — tests for: renders with title and close button, emits close on close button click, renders slot content, renders BottomSheet on mobile (mock matchMedia)

## 3. TourInfoSheet Integration

- [x] 3.1 Update `src/features/tours/presentation/components/tour-info-sheet.vue` — use `useIsDesktop` composable to conditionally render `<SideDrawer>` on desktop and `<BottomSheet>` on mobile, passing the same props and slot content to both

## 4. Map Page Updates

- [x] 4.1 Update `src/features/map/presentation/pages/map-page.vue` — change the tour info sheet transition: use a `slide-drawer` transition (translateX) on desktop instead of the shared `sheet` transition. On mobile, keep the existing slide-up transition.
- [x] 4.2 Update camera fly-to logic in `map-page.vue` — on desktop, apply `padding: { right: 400 }` (drawer width) instead of `{ bottom: 0 }`. Mobile stays with bottom padding from sheet height.

## 5. Finalize

- [x] 5.1 Run `npm run lint` and `npm run format` to ensure code quality
- [x] 5.2 Run `npm run test` to verify all tests pass
- [ ] 5.3 Prompt user to commit with conventional commit message
- [ ] 5.4 Prompt user to push branch and create PR
