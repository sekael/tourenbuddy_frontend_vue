## MODIFIED Requirements

### Requirement: Map action overlay icons

The map action overlay SHALL display FABs with Material Symbols icons: `map` for base map picker, `person` for profile, `person_add` for add contact, and `add_location_alt` for add tour. FABs SHALL use glassmorphism styling (semi-transparent background with backdrop blur) for visual separation from map content.

#### Scenario: FABs display Material Symbols

- **WHEN** the map page loads with the action overlay visible
- **THEN** each FAB displays its corresponding Material Symbol icon instead of emoji

#### Scenario: FABs have glass effect

- **WHEN** the map action overlay is visible over map content
- **THEN** FAB backgrounds are semi-transparent with a blur effect

### Requirement: Base map picker styling

The base map picker dropdown SHALL have a glassmorphism background, updated shadow (`--shadow-lg`), and `--color-outline-variant` border. Menu items SHALL use `--color-on-surface` text with hover highlighting.

#### Scenario: Map picker dropdown renders with glass effect

- **WHEN** user opens the base map picker menu
- **THEN** the dropdown has a semi-transparent blurred background with subtle border

### Requirement: Location picker button styling

The location picker cancel and continue buttons SHALL use the updated button styling conventions. Cancel uses secondary style, continue uses primary style. Both SHALL have 12px border-radius.

#### Scenario: Location picker buttons render with updated styling

- **WHEN** the location picker is active
- **THEN** cancel and continue buttons display with the modern button styles

### Requirement: Round action button size and style

The round action button (FAB) component SHALL be 52px diameter (increased from 48px) with `--shadow-md` layered shadow. It SHALL accept Material Symbols icon content via its default slot.

#### Scenario: FAB renders at updated size

- **WHEN** a round action button is rendered
- **THEN** it is 52x52px with a layered shadow
