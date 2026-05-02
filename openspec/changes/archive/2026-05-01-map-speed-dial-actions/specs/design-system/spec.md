## ADDED Requirements

### Requirement: FAB surface color tokens

The design system SHALL define light-blue color tokens for floating-action-button surfaces used by the map overlay so they remain visually distinct from the Swisstopo terrain backdrop. The tokens SHALL be: `--color-fab-surface` (default surface, light blue), `--color-fab-surface-strong` (hover/active surface, slightly darker light blue), and `--color-fab-on-surface` (icon and label color with sufficient contrast on the surface). The token values SHALL meet WCAG AA contrast for body text (≥ 4.5:1) when the on-surface color is rendered against either surface variant.

#### Scenario: Tokens defined in tokens.css

- **WHEN** any component references `var(--color-fab-surface)`, `var(--color-fab-surface-strong)`, or `var(--color-fab-on-surface)`
- **THEN** the value SHALL resolve to the documented light-blue palette

#### Scenario: Contrast meets AA

- **WHEN** the on-surface color is composited over either surface variant at full opacity
- **THEN** the contrast ratio SHALL be at least 4.5:1
