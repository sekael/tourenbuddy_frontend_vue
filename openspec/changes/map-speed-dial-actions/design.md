## Context

`map-action-overlay.vue` (~160 lines) renders a vertical column of 6+ FABs anchored bottom-right of the map. As features grew (feedback, tours, base-map picker, contacts with badge, profile, add-tour, conditional compass), the column lengthened and now visually dominates the map view. Icons are not self-explanatory — new users hover for tooltips on desktop and have no affordance on mobile. Issue #70 asks for a speed-dial pattern with labeled actions and a more distinct color separating buttons from terrain.

The component is rendered by `map-page.vue` on both mobile and desktop and emits events upward (`open-profile`, `open-contacts`, `open-tours`, `open-feedback`, `reset-bearing`). Add-tour and base-map switching are handled internally via `useMapStore` and `BaseMapPicker`.

## Goals / Non-Goals

**Goals:**

- One persistent collapsed trigger replaces the FAB column.
- Each menu entry shows an icon + text label so function is obvious without hover.
- Light-blue surface tone clearly distinct from Swisstopo terrain.
- Accessible: keyboard, focus, ARIA.
- Backward-compatible event API toward `map-page.vue` — no changes there.
- Component split keeps each file <150 lines per conventions.

**Non-Goals:**

- Reworking sheets, dialogs, or the picking flow.
- Reworking `BaseMapPicker` internals — only its host changes.
- Adding new actions beyond what already exists.
- E2E tests (Playwright not yet configured).

## Decisions

### 1. Trigger semantics: dedicated speed-dial trigger, no overloaded primary action

**Decision:** The trigger button's only action is open/close the menu. "Add tour" lives as a menu item.

**Alternatives considered:**

- _Trigger = Add tour, long-press opens menu_: Discoverability poor on mobile.
- _Trigger = Add tour, secondary chevron opens menu_: Two hit-targets in one FAB hurts touch ergonomics.
- _Split trigger (FAB + caret)_: Visual noise undermines the goal of a cleaner overlay.

**Rationale:** A single-purpose trigger is the most intuitive and matches Material Design's speed dial pattern. Add-tour remains the visually first/topmost item in the expanded menu, retaining prominence without sacrificing discoverability of the others.

**Trigger icon:** a single `add` (plus sign) glyph, generic and not reused from any menu action. On open, the same glyph rotates 45° clockwise to form an "X", signaling that re-tapping closes the menu. CSS `transform: rotate(45deg)` with a 150ms ease transition; no icon swap. Tooltip "Menu" / "Close menu".

### 2. Layout: vertical menu above the trigger

Menu items stack vertically and animate in from the bottom-up (staggered translateY + fade, 30ms per item, total ≤180ms). Each item is a pill with the **label on the left and the icon on the right** — the icon column is fixed-width and right-aligned, so all item icons line up vertically regardless of label length, forming a clean visual axis with the trigger below. Labels grow leftward; the pill width hugs its content. The column is right-aligned with the trigger.

Implementation: pills use `display: inline-flex; flex-direction: row;` with order `[label][icon]`. The icon element has a fixed width (e.g. `width: 24px; flex: none; text-align: center`) and pills are right-anchored (`align-self: flex-end` in the menu's `flex-direction: column; align-items: flex-end` container) so the icon column inherits the trigger's right edge.

Add-tour is the **topmost** menu item (closest to the trigger, primary action), then Tours, Contacts, User profile, Change base map, Feedback. Order optimizes for tap distance from the trigger by frequency.

### 3. Color: introduce `--color-fab-surface` token (light blue)

Add tokens in `app/theme/tokens.css`:

- `--color-fab-surface: #dbeafe` (Tailwind blue-100, light) — base for FAB background at 0.85 alpha with `backdrop-filter: blur(10px)`.
- `--color-fab-surface-strong: #bfdbfe` (blue-200) — hover/active.
- `--color-fab-on-surface: #1e3a8a` (blue-900) — icon + label color, AA contrast on the lightened surface.

Existing `--color-accent` (#3b82f6) is too saturated for a glassy surface; introduce a light-blue surface token instead. The slate FAB tone currently used (`rgba(248,250,252,0.75)`) blends into snowy/light Swisstopo terrain; light blue separates without being aggressive.

### 4. Compass FAB stays separate

Compass is conditional and contextually about map orientation, not navigation between sheets. It renders as a small circular FAB above the speed-dial trigger when `|bearing| > 0.5`. It remains unaffected by menu expansion.

### 5. Badge bubble-up

When `pendingIncomingCount > 0`:

- Contacts menu item shows the count badge to the right of its label.
- Collapsed trigger shows a smaller dot (no count) at top-right to indicate "something needs attention" without revealing details prematurely.
- When the menu opens, the trigger's dot is hidden (the in-menu badge is sufficient).

### 6. Dismissal model

- Click trigger → toggle.
- Click any menu item → invoke its action AND close the menu.
- ESC key while open → close, focus returns to trigger.
- Click anywhere outside the menu/trigger → close. Implemented via a transparent fixed-position backdrop (`pointer-events: auto`, transparent) mounted only while open. The backdrop sits below the menu but above the map; map background clicks therefore close the menu without also dismissing any open sheet.
- When `isPickingLocation` becomes true → menu force-closes and the entire overlay (trigger + compass) hides, matching current behavior.

### 7. Component split

- `map-action-overlay.vue`: orchestration (compass, trigger, mounts the menu via `<Transition>`, owns expansion state, badge bubble-up). Wires existing emits unchanged.
- `map-speed-dial-menu.vue`: the expanded list — receives an `items` prop (icon, label, badge?, disabled?, tooltip?, onClick) and emits `select`. Owns enter/leave transitions and focus management.
- `speed-dial-item.vue`: a single labeled pill (kept tiny — used by the menu).
- `BaseMapPicker` continues to be a self-contained popover. Inside the menu it renders as a `speed-dial-item` whose action toggles its own popover anchored to the menu item; popover stays open when the menu closes? **Decision:** clicking "Change base map" closes the menu and opens the existing `BaseMapPicker` popover anchored from where it currently lives. To keep this simple, retain `BaseMapPicker`'s self-managed open state but expose a programmatic `open()` method called from the menu item's click handler. If that proves invasive in implementation, fall back to inlining the picker as a submenu inside the speed dial.

### 8. Accessibility

- Trigger: `role="button"`, `aria-haspopup="menu"`, `aria-expanded="<bool>"`, `aria-controls="speed-dial-menu"`.
- Menu container: `role="menu"`, `id="speed-dial-menu"`.
- Items: `role="menuitem"`, native `<button>`. Disabled items use `aria-disabled` + native `disabled`.
- On open: focus moves to first enabled item.
- Arrow Up/Down moves focus through items, wrapping. Home/End jump to first/last. ESC closes and returns focus to trigger.
- Outside click does not steal focus (closes silently).
- Tooltips remain via `title` attribute; labels are in the visible text, so tooltips are now redundant but kept for parity with the rest of the app.

### 9. i18n keys

New keys under `map.overlay`:

- `menuOpen`, `menuClose` (trigger tooltip)
- `addTour`, `tours`, `contacts`, `profile`, `changeBaseMap`, `feedback` (item labels)

Existing `*Tooltip` keys are reused for `title` attributes where present.

## Risks / Trade-offs

- **Discoverability vs. economy of taps**: Speed dial adds one tap to reach any action. → Mitigate by making the trigger high-contrast, persistent, and well-positioned; users learn the pattern fast and the gain is screen real estate.
- **Base map picker integration**: Embedding the existing self-managed popover inside a menu item is the trickiest part. → Fallback plan: inline a base-map submenu directly inside the speed dial (radio list of styles) and deprecate the standalone `BaseMapPicker` mounting from the overlay. This is captured as an open question.
- **Light-blue tone vs. blue water polygons in Swisstopo tiles**: At low zoom over lakes the FABs may camouflage. → The 0.85 surface alpha + outline + shadow keep them legible; QA on Lake Geneva / Zürich zooms.
- **Mobile bottom-sheet collisions**: When a sheet is open, the speed dial sits over its top-right corner. Current FAB column has the same issue and is acceptable. → No change in behavior; `pointer-events: none` on the sheet container already lets FABs receive clicks.
- **Animation cost on low-end devices**: Staggered transforms are GPU-cheap. Caps at ≤180ms total open animation.
- **Test surface widens**: The menu introduces focus/keyboard interactions. → Cover ESC, outside-click, badge visibility, disabled add-tour with happy-dom; document any happy-dom limitations encountered.

## Open Questions

- Should "Change base map" stay as a popover trigger or be inlined as a submenu? Decide during implementation; default = popover trigger (decision 7), fallback = inlined submenu.
- Should the trigger badge dot be styled exactly like the contacts badge (primary color circle) or use the new light-blue scheme? Default = use the contact-badge color (`--color-primary`) for cross-overlay consistency.
