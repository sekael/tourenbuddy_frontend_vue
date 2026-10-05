## RENAMED Requirements

- FROM: `### Requirement: DialogWindow renders as centered modal on desktop`
- TO: `### Requirement: DialogWindow renders as a content-sized modal on desktop`

## MODIFIED Requirements

### Requirement: DialogWindow renders as a content-sized modal on desktop

The `DialogWindow` component SHALL render as a horizontally centered modal card over a semi-transparent backdrop on viewports at or above 600px. The card SHALL hang from a fixed top inset (`clamp(24px, 12dvh, 7rem)`) and keep the same inset below. Its height SHALL follow its current content: exactly as tall as its header plus content, gliding to a new height whenever the content's height changes (growing or shrinking), and capped at the viewport height minus both insets, beyond which the content region scrolls. It SHALL NOT be used on viewports below 600px.

#### Scenario: Centered dialog appearance

- **WHEN** a `DialogWindow` is mounted on a viewport at or above 600px
- **THEN** the dialog card SHALL be centered horizontally with its top edge on the top inset
- **AND** the card SHALL have fully rounded corners (`border-radius: var(--radius-lg)` on all sides)
- **AND** the card SHALL apply `box-shadow: var(--shadow-lg)`
- **AND** the card SHALL cap its width at `560px`

#### Scenario: Backdrop scrim

- **WHEN** a `DialogWindow` is mounted on a viewport at or above 600px
- **THEN** a fullscreen backdrop SHALL be rendered behind the card with background `var(--color-backdrop)` (`rgba(15, 23, 42, 0.35)`) and `backdrop-filter: blur(var(--overlay-backdrop-blur))` (8px)

#### Scenario: Height follows the content

- **WHEN** the slotted content changes height (a view or tab swap, data loading)
- **THEN** the card SHALL glide to the new height over `--motion-duration-medium` with `--motion-ease-emphasized`
- **AND** the card's top edge, and with it the header, SHALL NOT move
- **AND** the first height after opening SHALL apply without a glide

#### Scenario: Content taller than the screen

- **WHEN** the content needs more height than the viewport minus both insets
- **THEN** the card SHALL stop at that height, with equal margins above and below it
- **AND** the content region SHALL scroll

#### Scenario: Collapsed header bar

- **WHEN** a `DialogWindow` is collapsed (e.g. while the user picks a location for a new tour)
- **THEN** it SHALL shrink to a header-only bar pinned to the top edge of the viewport
- **AND** when expanded again it SHALL return to its top inset and its content's height

## ADDED Requirements

### Requirement: DialogWindow enter animation

The `DialogWindow` SHALL animate in with a fade, a short drop onto its top line, and a subtle scale-up, taking its timing and travel from the motion tokens.

#### Scenario: Enter animation

- **WHEN** a `DialogWindow` enters the DOM
- **THEN** its card SHALL animate from `opacity: 0; transform: translateY(calc(-1 * var(--motion-offset))) scale(0.98)` to its resting state over `--motion-duration-medium` with `--motion-ease-emphasized`, scaling from its top edge

## REMOVED Requirements

### Requirement: DialogWindow fade-scale animation

**Reason**: Replaced by "DialogWindow enter animation" (a drop onto the top line instead of a centred scale-up). The symmetric exit it described is not what ships: `DialogWindow` has no exit animation of its own, and overlays whose component renders several root nodes (profile, feedback) unmount without one, while single-root overlays get the host's sheet transition. A consistent dialog exit is a follow-up.
**Migration**: None for consumers; the entrance is automatic.
