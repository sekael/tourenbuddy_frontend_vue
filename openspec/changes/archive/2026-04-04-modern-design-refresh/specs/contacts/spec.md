## MODIFIED Requirements

### Requirement: Contact chip design

The contact chip SHALL have a pill shape (border-radius: 9999px). When unselected, it SHALL have a transparent background with `--color-outline-variant` border. When selected, it SHALL have a subtle `--color-primary` tint background (10-15% opacity) with `--color-primary` border and `--color-primary` text, and display a Material Symbols `check` icon. Hover state SHALL use `--color-surface-variant` background.

#### Scenario: Selected chip uses tint instead of solid fill

- **WHEN** a contact chip is in selected state
- **THEN** it displays with a subtle primary-tinted background rather than a solid primary fill

#### Scenario: Chip uses Material Symbols checkmark

- **WHEN** a contact chip is selected
- **THEN** a Material Symbols `check` icon is displayed instead of a Unicode checkmark

### Requirement: Contact creation dialog styling

The contact creation dialog SHALL use the same modern dialog styling as tour creation: `--color-surface` background, `--shadow-lg`, 16px border-radius, `--color-outline-variant` border. The close/cancel button SHALL use Material Symbols `close` icon. Input fields SHALL use updated input styling.

#### Scenario: Contact creation dialog renders with modern design

- **WHEN** user opens the contact creation dialog
- **THEN** the dialog displays with updated color tokens, shadows, and input styles
