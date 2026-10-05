# Tasks

## 1. Git Setup

- [x] 1.1 Create feature branch `feat/modern-design-preview` from latest `main` and verify `git branch --show-current` prints it

## 2. Tokens

- [x] 2.1 Add primitives (blue 50/600/950 — indigo in the first cut, slate-800, amber-600, amber-700) and semantic tokens `--color-inverse-surface`, `--color-on-inverse-surface`, `--color-warning-strong`, `--color-warning-text`, motion tokens, `--hover-scale`, `--press-scale` to `tokens.css` with Classic values equal to today's literals; verify `npm run type-check` and the dev build still load
- [x] 2.2 Add the `:root[data-design='alpenglow']` override block (D6 palette, radius/shadow scales, pill `--button-radius`, motion, press) and the reduced-motion block; verify white-on-primary contrast ≥ 4.5:1
- [x] 2.3 Update `DESIGN.md` (variants, motion/interaction tokens, inverse/warning roles, promote-the-winner procedure) and verify it points to `tokens.css` for values

## 3. Variant switching

- [x] 3.1 Add `src/core/theme/design-variant.ts` (read/whitelist/apply/persist) with tests for unknown stored value, throwing storage on read and on write; verify `npm run test -- design-variant`
- [x] 3.2 Apply the stored variant in `src/main.ts` before `bootstrap()`; verify `<html data-design>` is set on first load
- [x] 3.3 Add the Classic / Alpenglow switcher under the language selector in `user-profile-sheet.vue` with `en.json` + `de-CH.json` keys; add a test that tapping an option updates `<html data-design>` and the active state; verify `npm run test -- user-profile-sheet`

## 4. Consume tokens in shared components

- [x] 4.1 `base-button`, `base-icon-button`, `round-action-button`, `extended-fab`: transitions on motion tokens, hover on `--hover-scale`, `:active` press feedback per D2; verify Classic hover/press unchanged in the browser
- [x] 4.2 Overlay motion: `map-page` sheet transition, `dialog-window` enter, `side-drawer` slide, `error-snackbar`, `tour-action-bar` pill, `pwa-install-banner` / `update-prompt` banners, offline chip/toast transitions; verify Classic timing unchanged
- [x] 4.3 Drift fixes: offline toasts/chip/dead-letter onto inverse/warning/error/outline tokens, `--color-danger` → `--color-error`, five dialog backdrops → `var(--color-backdrop)`; verify `grep -rn "color-slate-\|color-amber-\|color-red-6\|color-danger" src` is empty
- [x] 4.4 Theme color `#e65100` → `#ffffff` in `index.html` and the `vite.config.ts` manifest; verify `grep -rn e65100 index.html vite.config.ts` is empty

## 5. Integration check

- [x] 5.1 Switch Classic ↔ Alpenglow in the running app (auth, map + speed dial, profile sheet, calendar at 390×844) and confirm the whole UI re-themes; Classic parity with `main` is by construction (each new token equals the literal it replaced), not a pixel diff

## 6. Iteration 2 — consistent UI elements (D7)

- [x] 6.1 Define component tokens in the Alpenglow block (buttons, overlay, headings, field label, input, chip, tabs, divider) and document the fallback convention in `tokens.css` + `DESIGN.md`; verify `:root` defines none of them (`grep` the `:root` block)
- [x] 6.2 Buttons: `base-button` variants + min-heights on component tokens, with Classic fallbacks; verify `base-button` tests pass
- [x] 6.3 Overlay chrome: `bottom-sheet`, `dialog-window`, `side-drawer`, `full-screen-page` (border, header/footer dividers, title size/tracking, tonal close/back, backdrop blur); verify overlay tests pass
- [x] 6.4 Section headings, field labels, inputs, selectable chips, tabs, dividers migrated in every consumer found by the audit; verify by re-running the audit that no consumer of those families is left without the token
- [x] 6.5 Screenshot Classic vs Alpenglow (map menu, profile, calendar, tour list, a dialog) and confirm Classic unchanged and Alpenglow consistent

## 7. Iteration 3 — blue, motion, declutter (D8, D9)

- [x] 7.1 Swap the Alpenglow palette from indigo to blue and verify white-on-primary contrast ≥ 4.5:1 (5.17:1)
- [x] 7.2 Sliding tab indicator utility + four tab rows, tour-list tab panel swap, sheet-swap in `map-page`, push/pop in the contacts sheet, snap tokens; verify per-frame samples show the slide in Alpenglow and an instant swap / unchanged slide in Classic
- [x] 7.3 Declutter tokens (section dividers, tonal toggles row, season pill, cards) and verify with realistic-data screenshots that sections, toggles, and cards render without lines/outlines in Alpenglow and unchanged in Classic
- [x] 7.4 Structural fixes: contact detail single header (+ `DialogWindow` `header-actions`), tour row planned date with tests for the undated and other-year cases, tour-edit Save `sm`; verify `npm run test`

## 8. Iteration 4 — map controls, contrast, calm motion, stable UI (D10, D11)

- [x] 8.1 Map controls on blue-700 glass, white dot/badge, map chips via `--map-chip-*`; verify white-text contrast ≥ 4.5:1 at the 85% mix (4.92:1) and by screenshot
- [x] 8.2 Calmer motion tokens (durations, curves, overshoot, offsets, press); verify per-frame sampling and screenshots
- [x] 8.3 axe-core WCAG 2.2 A/AA audit of all main screens in both variants; fix every violation (tinted-text roles, `--color-success-text`, hint/warning text, GPX input name, attribution underline, guided-tour finish button); verify the audit reports zero violations
- [x] 8.4 Base-map options anchored to their menu item; verify per frame that the panel settles at the item's top and the menu fades without a transform
- [x] 8.5 `stableSize` dialogs for contacts, friend requests, profile; verify on desktop that list → detail → requests → blocked stays 640 px in both variants
- [x] 8.6 Walk the guided tour end-to-end (German, all 9 steps) and confirm every step's target and copy still match the UI

## 9. Iteration 5 — one design, consistency sweep (D12)

- [x] 9.1 Promote Alpenglow to `:root`; delete the variant block, `design-variant.ts` (+ test, `main.ts` call), the profile switcher and its i18n keys; strip dead fallbacks; delete no-op tokens with the declarations/markup they hid; inline single-use tokens
- [x] 9.2 Repurpose `component-tokens.test.ts` to fail on undefined tokens; fix the two typos it finds
- [x] 9.3 Control-container role; tonal `BaseButton` variants, `BaseIconButton variant="tonal"` for all close/back, tour toggles, calendar nav/back, map Cancel → shared `Button`; verify contrast incl. hover fills
- [x] 9.4 `SpeedDialItem` single pill shared by menu and base-map options; `.fab-glass` on every map control; trigger icon morph; staggered unfold; generic landscape arc; verify per-frame sampling and landscape boxes
- [x] 9.5 Global segmented-control rule for all tab rows + filter switch; sentence-case labels; tabular coordinates; footer content fade; tour popover styling + edge gutter; move every remaining transition onto motion tokens
- [x] 9.6 axe audit of all main screens (zero violations, incl. named notification switches); desktop dialog height stays 640px; walk the guided tour (all 9 steps, sub-steps of the menu/base-map/tabs/notification steps)

## 10. Iteration 6 — unfold in place, profile at a glance (D13)

- [x] 10.1 Base-map options in the menu's slot beside "Change base map"; menu items inert + dimmed; overlay `pointer-events: none` except controls/backdrop; landscape placement; focus the checked option; tests for inert items and collapse on choice; verify per-frame unfold, outside tap, portrait (en/de, 360/390) and landscape boxes
- [x] 10.2 `profile-overview.vue` (identity card, settings card with inline language + summaries, app tour row, Sign out); sections as views (pages on mobile, back on desktop); shared `view-push`/`view-pop` in `global.css`; tests for the summaries' edge cases
- [x] 10.3 Calendar sync in titled groups with feed tiles; feed-error text on the error-text role; Sync now / Regenerate / Cancel / Resend → secondary; section titles move to the header
- [x] 10.4 Guided tour: phone step spotlights the profile card, notifications step the Notifications row, copy updated (en/de); driver.js clip fix for the base-map step; walk steps 1, 2 and 8
- [x] 10.5 axe audit of all main screens plus the four new profile views (zero violations); overview fits 390×844 and 360×780 without scrolling
- [x] 10.6 Dialogs fit their content: remove `stableSize`; `.dialog-body` measured by a ResizeObserver drives the scroll box height (glides both ways, first size instant); top-anchored card; tests for shrink rounding and collapsed; verify on desktop that the header stays at one top line while profile (525 → 475 → 525 → 733 capped → 525), contacts (436 → 458 → 436), friend requests (503 → 230 → 503) and feedback (270) fit with 0–1px spare and one height glide per change, that tour creation still collapses to its header bar and expands, and that a fully extended dialog keeps equal margins above and below (103/103 at 860px, 72/72 at 600px)
- [x] 10.7 Bring specs in line with the implementation before archiving: delta specs for `dialog-window`, `responsive-overlay`, `map-integration`, `speed-dial-icon-transition`, `phone-verification`, `tour-action-bar`, `onboarding-tour`, `user-profile`; design-system wording (chips, danger-outline, banner surface, motion tokens incl. `--motion-stagger`); remove stray delta headers from the `map-integration` and `phone-verification` main specs; validate change and specs

## 11. Finalize

- [x] 11.1 Run `npx eslint . --fix`, `npm run type-check`, `npm run test`; all pass with zero warnings
- [x] 11.2 Provide a ready-to-copy conventional commit message (`feat(design): …`)
- [x] 11.3 Push the branch and open a PR so the preview deploy (`<branch-slug>.tourenbuddy.pages.dev`) allows on-device comparison against prod
