## Purpose

Centered modal dialog used on desktop for confirmations, forms, and destructive-action prompts.

## Requirements

### Requirement: DialogWindow renders as centered modal on desktop

The `DialogWindow` component SHALL render as a horizontally and vertically centered modal card over a semi-transparent backdrop on viewports at or above 600px. It SHALL NOT be used on viewports below 600px.

#### Scenario: Centered dialog appearance

- **WHEN** a `DialogWindow` is mounted on a viewport at or above 600px
- **THEN** the dialog card SHALL be centered horizontally and vertically within the viewport
- **AND** the card SHALL have fully rounded corners (`border-radius: var(--radius-lg)` on all sides)
- **AND** the card SHALL apply `box-shadow: var(--shadow-lg)`
- **AND** the card SHALL cap its height at `90dvh` and its width at `560px`

#### Scenario: Backdrop scrim

- **WHEN** a `DialogWindow` is mounted on a viewport at or above 600px
- **THEN** a fullscreen backdrop SHALL be rendered behind the card with background `rgba(15, 23, 42, 0.35)` and `backdrop-filter: blur(2px)`

### Requirement: DialogWindow API contract

The `DialogWindow` component SHALL accept `title?: string` and `ariaLabel?: string` props, emit a `close` event, provide a default slot for content, and render a header with the title and a close button.

#### Scenario: Props, emits, and slot

- **WHEN** a `DialogWindow` is instantiated with a `title`
- **THEN** the header SHALL display the title text
- **AND** the header SHALL include a close button with `aria-label="Close"`
- **AND** clicking the close button SHALL emit `close`
- **AND** the default slot SHALL render inside a scrollable content region

#### Scenario: Backdrop click dismisses

- **WHEN** a `DialogWindow` is open
- **AND** the user clicks the backdrop outside the card
- **THEN** the component SHALL emit `close`

#### Scenario: Content click does not dismiss

- **WHEN** a `DialogWindow` is open
- **AND** the user clicks inside the card
- **THEN** the component SHALL NOT emit `close`

### Requirement: DialogWindow fade-scale animation

The `DialogWindow` SHALL animate in with a fade-in and subtle scale-up transition and animate out symmetrically.

#### Scenario: Enter and leave animations

- **WHEN** a `DialogWindow` enters the DOM
- **THEN** it SHALL transition from `opacity: 0; transform: scale(0.95)` to `opacity: 1; transform: scale(1)`
- **AND** when leaving, it SHALL reverse that transition

### Requirement: DialogWindow a11y attributes

The `DialogWindow` SHALL expose appropriate ARIA attributes for a modal dialog.

#### Scenario: ARIA markup

- **WHEN** a `DialogWindow` is rendered
- **THEN** the card SHALL have `role="dialog"` and `aria-modal="true"`
- **AND** if `title` is provided, the card SHALL be labelled by the title element via `aria-labelledby`
- **AND** if `title` is absent but `ariaLabel` is provided, the card SHALL use `aria-label` with that value

### Requirement: Dialog content reserves scrollbar gutter

The scrollable content region of `DialogWindow` SHALL reserve space for the scrollbar so the scrollbar never overlaps content. Existing thin scrollbar styling SHALL be retained.

#### Scenario: Content overflows dialog
- **WHEN** the slotted content overflows the dialog's content region in a browser that honors `scrollbar-gutter`
- **THEN** a scrollbar gutter SHALL be reserved on the inline-end side
- **AND** content SHALL NOT shift horizontally when the scrollbar appears or disappears

#### Scenario: Mobile/overlay scrollbar fallback
- **WHEN** the dialog content overflows in a browser using overlay scrollbars
- **THEN** the overlay scrollbar SHALL sit over reserved right padding inside the content region and SHALL NOT overlap interactive controls

### Requirement: Dialog body scroll is contained

The scrollable body region of `DialogWindow` SHALL contain its scroll: when scrolled past
either end, the scroll SHALL NOT chain to any ancestor — not the page behind the dialog,
not the document, and not a map rendered beneath it. The region's own end-of-scroll
affordance (rubber-band on platforms that provide one) SHALL be preserved.

#### Scenario: Overscrolling a dialog does not move the page behind it

- **WHEN** the dialog body is scrolled to its top or bottom edge
- **AND** the user continues the scroll gesture in the same direction
- **THEN** no ancestor scroll container SHALL scroll
- **AND** the document scroll offset SHALL remain unchanged

### Requirement: Dialog body scrolls vertically only

The dialog body SHALL scroll on the vertical axis only, regardless of child content width.

#### Scenario: Horizontal swipe over the dialog body does nothing

- **WHEN** the user swipes or drags horizontally within the dialog body
- **THEN** the dialog body SHALL NOT scroll horizontally
