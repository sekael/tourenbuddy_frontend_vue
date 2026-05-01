## Why

Map page currently shows a vertical column of 6+ floating action buttons (compass, feedback, profile, base-map picker, contacts, tours, add-tour) that clutters the map view and obscures terrain. Icons alone are not self-explanatory for new users — labels are needed to communicate function. Issue #70.

## What Changes

- Replace the vertical FAB stack in `map-action-overlay.vue` with a single primary speed-dial trigger anchored bottom-right.
- Tap trigger → expands a vertical column of labeled action items (icon + text label) for: Add tour, Tours, Contacts, User profile, Change base map, Feedback.
- Add-tour is the speed-dial trigger's primary action shown in the collapsed state (most-used CTA); tapping the trigger opens the menu, while a distinct "Add tour" item inside the menu starts the pick-location flow. Final trigger semantics decided in design.md.
- Compass FAB stays separate and conditional (visible only when `bearing != 0`), rendered above the speed dial — not part of the expanded menu.
- Restyle FABs and speed-dial surface with a light-blue tone to stand out from the map backdrop. Add a design-system token if needed.
- Pending friend-request badge: shown on the Contacts menu entry AND bubbled up as an indicator dot on the collapsed speed-dial trigger.
- Menu closes on: trigger re-tap, action selection, outside click, ESC key.
- All labels via vue-i18n for `en` and `de-CH`.
- Accessibility: `aria-expanded`, `aria-haspopup`, focus trap when open, keyboard navigation (Tab, Arrow keys, ESC).
- Disabled "Add tour" item retains current unauthenticated tooltip behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `map-integration`: Map action overlay requirements change from a static FAB column to a speed-dial pattern with labeled actions, badge bubbling, and keyboard/a11y semantics.
- `design-system`: Adds light-blue FAB surface token (or documents reuse of existing accent token) for map overlay buttons.

## Impact

- `src/features/map/presentation/components/map-action-overlay.vue` — rewritten.
- New sub-component(s) likely: `map-speed-dial.vue`, `speed-dial-item.vue` (to keep files <150 lines per conventions).
- `src/app/theme/tokens.css` — possible new token for light-blue FAB surface.
- `src/locales/en.json`, `src/locales/de-CH.json` — new keys under `map.overlay.*` for action labels.
- `test/features/map/presentation/components/map-action-overlay.spec.ts` — updated; new tests for speed-dial behavior.
- No backend / data-layer impact. No router changes. Caller `map-page.vue` keeps the same emitted event contract.
