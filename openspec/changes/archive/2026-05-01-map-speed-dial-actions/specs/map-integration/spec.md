## MODIFIED Requirements

### Requirement: Map action overlay with FABs

The map page SHALL display a single primary speed-dial trigger floating action button anchored to the bottom-right of the map. The trigger SHALL toggle a vertical labeled menu that exposes the available map actions: add tour, tours list, contacts, user profile, change base map, and feedback. Each menu item SHALL show both an icon and a localized text label so its function is discoverable without hovering. A conditional compass FAB SHALL remain separate from the speed dial and SHALL render above the trigger only when the map bearing is non-zero.

#### Scenario: Speed-dial trigger renders

- **WHEN** the map page loads and the user is not picking a location
- **THEN** a single speed-dial trigger FAB SHALL be rendered at the bottom-right of the map
- **AND** no other action FABs SHALL be visible in the collapsed state, except a conditional compass FAB when bearing is non-zero

#### Scenario: Trigger expands the action menu

- **WHEN** the user activates the speed-dial trigger
- **THEN** a vertical menu SHALL expand above the trigger listing the available actions, each with an icon and a localized label

#### Scenario: Menu items execute actions

- **WHEN** the user activates a menu item
- **THEN** the corresponding action SHALL execute (open profile sheet, open contacts sheet, open tours sheet, open feedback sheet, start add-tour pick, or open the base-map picker)
- **AND** the menu SHALL close

#### Scenario: Add tour disabled when not authenticated

- **WHEN** the user is not authenticated
- **THEN** the add-tour menu item SHALL be disabled and SHALL expose a tooltip indicating sign-in is required

#### Scenario: Compass FAB remains conditional

- **WHEN** the map bearing has a magnitude greater than 0.5 degrees
- **THEN** a compass FAB SHALL render above the speed-dial trigger
- **AND** activating it SHALL emit `reset-bearing`

#### Scenario: Buttons hidden during location picking

- **WHEN** the map is in location picker mode
- **THEN** the speed-dial trigger, compass FAB, and any expanded menu SHALL be hidden

### Requirement: Map action overlay icons

The map action overlay's speed-dial trigger SHALL display a generic plus-sign (`add`) Material Symbols glyph that is NOT reused from any of the menu action icons, indicating that the trigger opens a menu of multiple options rather than performing a specific action. When the menu is opened, the same plus glyph SHALL rotate 45 degrees to form an "X", signaling that re-activating the trigger closes the menu; no icon swap SHALL occur. Menu items SHALL use Material Symbols: `add_location_alt` for add tour, `location_on` for tours, `group` for contacts, `account_circle` for profile, `map` for change base map, `feedback` for feedback. Each menu item SHALL be rendered as a pill with the localized label on the left and the icon on the right; all menu-item icons SHALL share a fixed-width icon column aligned along a single vertical axis, regardless of label length. The speed-dial surface and menu items SHALL use a light-blue tone (per the design-system FAB surface tokens) with backdrop blur for visual separation from map content.

#### Scenario: Trigger uses a generic plus glyph

- **WHEN** the speed-dial trigger is rendered
- **THEN** it SHALL display the Material Symbols `add` glyph
- **AND** that glyph SHALL NOT be reused as the icon of any menu item

#### Scenario: Trigger glyph rotates to X when menu opens

- **WHEN** the speed-dial menu is collapsed
- **THEN** the trigger glyph SHALL be rendered with no rotation
- **WHEN** the speed-dial menu is expanded
- **THEN** the same trigger glyph SHALL be rotated 45 degrees so that it visually forms an "X"
- **AND** no icon swap SHALL take place between collapsed and expanded states

#### Scenario: Menu items display correct icons

- **WHEN** the speed-dial menu is open
- **THEN** each menu item SHALL display its corresponding Material Symbol on the right and its localized label on the left

#### Scenario: Menu-item icons are vertically aligned

- **WHEN** the speed-dial menu is open and contains menu items with labels of differing lengths
- **THEN** every menu item's icon SHALL be horizontally positioned along a single shared vertical axis
- **AND** that axis SHALL align with the speed-dial trigger's icon below

#### Scenario: Surface uses light-blue tone

- **WHEN** the speed-dial trigger or any menu item is rendered
- **THEN** its background SHALL resolve from the design-system FAB surface token and SHALL apply a backdrop blur effect

### Requirement: Map action overlay exposes a Tours FAB

The speed-dial menu SHALL expose a Tours entry using the Material Symbols `location_on` icon and a localized "Tours" label, positioned between the Contacts and Add tour entries. Activating the Tours entry SHALL emit an `open-tours` event with no payload and SHALL close the menu. The Tours entry SHALL be unavailable while `mapStore.isPickingLocation` is `true` (the entire overlay hides during picking, per the action overlay requirement).

#### Scenario: Tours entry rendered between Contacts and Add tour

- **WHEN** the speed-dial menu is open with a signed-in user and `isPickingLocation === false`
- **THEN** the Tours menu item SHALL appear immediately after the Contacts item and immediately before the Add tour item

#### Scenario: Tours entry emits open-tours and closes menu

- **WHEN** the user activates the Tours menu item
- **THEN** the overlay SHALL emit `open-tours`
- **AND** the speed-dial menu SHALL close

#### Scenario: Tours entry hidden during location picking

- **WHEN** `mapStore.isPickingLocation` becomes `true`
- **THEN** the speed-dial menu SHALL close and the entire overlay (including the Tours entry) SHALL be hidden

### Requirement: Map action overlay exposes a feedback entry point

The speed-dial menu SHALL expose a Feedback entry using the Material Symbols `feedback` icon and a localized "Feedback" label. Activating the entry SHALL emit an `open-feedback` event and SHALL close the menu. The overlay SHALL NOT own any feedback sheet state itself.

#### Scenario: Feedback entry rendered

- **WHEN** the speed-dial menu is open and the user is not currently picking a location
- **THEN** a Feedback entry SHALL be rendered alongside the other menu items

#### Scenario: Feedback entry emits event and closes menu

- **WHEN** the user activates the Feedback entry
- **THEN** the overlay SHALL emit `open-feedback`
- **AND** the speed-dial menu SHALL close
- **AND** the overlay SHALL NOT mutate any local sheet visibility state

## ADDED Requirements

### Requirement: Speed-dial dismissal behaviors

The speed-dial menu SHALL close in response to: re-activating the trigger, activating any menu item, pressing the Escape key while the menu is focused, and clicking outside the trigger and menu. Outside-click dismissal SHALL NOT additionally close any other open overlay (e.g., a tour info sheet).

#### Scenario: Trigger toggles the menu

- **WHEN** the speed-dial menu is open and the user activates the trigger
- **THEN** the menu SHALL close

#### Scenario: Escape closes the menu

- **WHEN** the speed-dial menu is open and the user presses the Escape key
- **THEN** the menu SHALL close
- **AND** focus SHALL return to the trigger

#### Scenario: Outside click closes only the menu

- **WHEN** the speed-dial menu is open
- **AND** the user clicks anywhere outside the trigger and menu
- **THEN** the menu SHALL close
- **AND** no other open overlay (tour info, contacts, profile, feedback) SHALL be dismissed by that click

#### Scenario: Picking-mode entry force-closes the menu

- **WHEN** `mapStore.isPickingLocation` transitions from `false` to `true` while the menu is open
- **THEN** the menu SHALL close immediately

### Requirement: Speed-dial accessibility and keyboard navigation

The speed-dial trigger SHALL be a button exposing `aria-haspopup="menu"`, `aria-expanded` reflecting the open state, and `aria-controls` referencing the menu container. The menu SHALL expose `role="menu"`, and each menu item SHALL be a focusable button with `role="menuitem"`. Keyboard interaction SHALL support: Tab to enter and exit the menu, Arrow Up/Down to move focus between items wrapping at ends, Home/End to jump to first/last item, Enter or Space to activate the focused item, and Escape to close.

#### Scenario: Trigger exposes correct ARIA state

- **WHEN** the speed-dial menu is closed
- **THEN** the trigger SHALL expose `aria-expanded="false"`
- **WHEN** the speed-dial menu is open
- **THEN** the trigger SHALL expose `aria-expanded="true"` and `aria-controls` SHALL reference the menu container's id

#### Scenario: Focus moves to first item on open

- **WHEN** the user activates the trigger and the menu opens
- **THEN** keyboard focus SHALL move to the first enabled menu item

#### Scenario: Arrow keys cycle focus

- **WHEN** the menu is open and the user presses Arrow Down on the last item
- **THEN** focus SHALL wrap to the first item
- **WHEN** the user presses Arrow Up on the first item
- **THEN** focus SHALL wrap to the last item

#### Scenario: Disabled items are skipped only via mouse

- **WHEN** the menu is open and an item is disabled
- **THEN** the disabled item SHALL expose `aria-disabled="true"` and SHALL NOT activate on Enter, Space, or click

### Requirement: Pending friend-request indicator on the speed dial

When `pendingIncomingCount > 0`, the Contacts menu entry SHALL display the pending count as a badge, AND the collapsed speed-dial trigger SHALL display a small indicator dot to signal that an action requires attention. While the menu is open, the trigger's indicator dot SHALL be hidden (the in-menu badge supersedes it).

#### Scenario: Trigger shows indicator dot when pending requests exist

- **WHEN** `pendingIncomingCount > 0` and the menu is collapsed
- **THEN** an indicator dot SHALL be rendered at the top-right of the speed-dial trigger

#### Scenario: Contacts menu item shows count badge

- **WHEN** `pendingIncomingCount > 0` and the menu is open
- **THEN** the Contacts menu item SHALL display a badge containing the count

#### Scenario: Trigger dot hides while menu open

- **WHEN** the menu is open
- **THEN** the trigger SHALL NOT render the indicator dot
