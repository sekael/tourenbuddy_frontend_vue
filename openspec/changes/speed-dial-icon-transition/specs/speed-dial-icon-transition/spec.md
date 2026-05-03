## ADDED Requirements

### Requirement: Speed dial trigger shows context-appropriate icon

The speed dial trigger SHALL display a `menu` icon when closed and a `close` icon when open. The transition between icons SHALL be a CSS opacity cross-fade. No rotation transform SHALL be applied to either icon.

#### Scenario: Closed state shows menu icon

- **WHEN** the speed dial is closed (`isOpen` is `false`)
- **THEN** the `menu` icon is fully visible (`opacity: 1`) and the `close` icon is hidden (`opacity: 0`)

#### Scenario: Open state shows close icon

- **WHEN** the speed dial is open (`isOpen` is `true`)
- **THEN** the `close` icon is fully visible (`opacity: 1`) and the `menu` icon is hidden (`opacity: 0`)

#### Scenario: Transition is a fade

- **WHEN** the open state toggles
- **THEN** the icon change animates via opacity transition (no rotation, no slide)
