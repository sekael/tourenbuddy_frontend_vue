## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/70-map-speed-dial-actions`

## 2. Design tokens

- [x] 2.1 Add `--color-fab-surface`, `--color-fab-surface-strong`, `--color-fab-on-surface` to `src/app/theme/tokens.css`
- [x] 2.2 Verify AA contrast of on-surface vs both surface variants (note ratio in commit message)

## 3. i18n keys

- [x] 3.1 Add `map.overlay.menuOpen`, `menuClose`, `addTour`, `tours`, `contacts`, `profile`, `changeBaseMap`, `feedback` to `src/locales/en.json`
- [x] 3.2 Mirror keys with translations in `src/locales/de-CH.json`

## 4. Speed-dial components

- [x] 4.1 Create `src/features/map/presentation/components/speed-dial-item.vue` — pill with label on the left and icon on the right; icon element uses a fixed width so icons align on a single vertical axis across items of varying label length; supports `disabled`, `badge` slot, `tooltip`; emits `select`
- [x] 4.2 Create `src/features/map/presentation/components/map-speed-dial-menu.vue` accepting an `items` prop (id, icon, label, badge?, disabled?, tooltip?), exposing `role="menu"`, focus management, Arrow/Home/End/Enter/Space/Escape handling, and enter/leave transitions
- [x] 4.3 Rewrite `src/features/map/presentation/components/map-action-overlay.vue` to render: conditional compass FAB, speed-dial trigger displaying the `add` (plus) glyph that rotates 45° to an "X" when expanded (CSS `transform: rotate(45deg)` with a 150ms ease transition; no icon swap), with aria-haspopup/aria-expanded/aria-controls and an indicator dot when `pendingIncomingCount > 0`, and the menu via `<Transition>`. Build the items list internally and forward existing emits (`open-profile`, `open-contacts`, `open-tours`, `open-feedback`, `reset-bearing`); handle add-tour and base-map picker internally as before
- [x] 4.4 Implement outside-click backdrop (transparent, mounted only while open) so map background clicks close the menu without dismissing other overlays
- [x] 4.5 Force-close menu when `isPickingLocation` becomes true; hide compass/trigger while picking
- [x] 4.6 Wire `BaseMapPicker` integration: from the "Change base map" menu item, close the menu and trigger the existing picker. If invasive, fall back to inlining a base-map submenu (per design.md decision 7) and update specs/tasks accordingly
- [x] 4.7 Apply light-blue surface tokens to trigger and items; preserve backdrop blur, shadow, hover transform
- [x] 4.8 Verify each new component file is < 150 lines; extract further if not

## 5. Map page integration

- [x] 5.1 Confirm `src/features/map/presentation/pages/map-page.vue` requires no changes (event API unchanged); adjust only if a regression is found

## 6. Tests

- [x] 6.1 Update `test/features/map/presentation/components/map-action-overlay.spec.ts`: collapsed state shows only trigger (and conditional compass), trigger toggles menu, menu items emit correct events and close menu
- [x] 6.2 Add tests: ESC closes menu and restores focus; outside-click closes menu; `isPickingLocation=true` hides overlay and force-closes menu
- [x] 6.3 Add tests: add-tour item disabled when `isAuthenticated=false`; clicking it does not start picking
- [x] 6.4 Add tests: trigger indicator dot rendered iff `pendingIncomingCount > 0` and menu collapsed; Contacts item shows count badge when menu open; trigger dot hidden while menu open
- [x] 6.5 Add tests: trigger ARIA attributes (`aria-haspopup`, `aria-expanded`, `aria-controls`) reflect open state; Arrow Down/Up wrap focus across items
- [x] 6.6 Add tests: trigger renders the `add` glyph in both states (no icon swap) and applies a 45° rotation class/style when menu is open
- [x] 6.7 Add tests: menu-item layout has label before icon in DOM order and icons share a consistent computed left offset across items with differing label lengths
- [x] 6.8 Run `npm run test` — all green

## 7. Manual QA

- [x] 7.1 `npm run dev`: verify mobile (<600px) and desktop (≥600px) layouts, menu open/close, all six actions, badge bubble-up, light-blue surface contrast over land + lake tiles, compass FAB visibility on rotation
- [x] 7.2 Verify location-picker mode still hides overlay; resuming after picker restores it
- [x] 7.3 Keyboard-only walkthrough: Tab to trigger → Enter → Arrow keys → Enter to activate → ESC

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix` and `npm run format` (zero warnings)
- [x] 8.2 Run `npm run type-check`
- [x] 8.3 Prompt user to commit. Suggested message:
      `feat(map): replace FAB column with labeled speed dial (#70)`
- [x] 8.4 Prompt user to push branch and open PR linking issue #70
- [x] 8.5 After merge, prompt user to archive change via `/opsx:archive map-speed-dial-actions`
