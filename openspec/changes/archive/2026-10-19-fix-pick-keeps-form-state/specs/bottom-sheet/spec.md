# Spec Delta

## MODIFIED Requirements

### Requirement: Data entry uses a full-screen page on mobile

On mobile, the bottom sheet SHALL be used for **view mode only**. Whenever the user enters or edits data — editing an existing entity, creating a new one, or any other text-entry form — the surface SHALL switch from the bottom sheet to a full-screen page that occupies the entire screen, with no map (or other content) visible behind it, so all real estate serves the form. When the edit/creation is saved or cancelled, the surface SHALL return to the bottom sheet view (map visible again, sheet capped at its normal height).

The full-screen page SHALL render an opaque surface covering the viewport (`position: fixed; inset: 0`), a fixed top app bar holding the cancel control (top-left) and the primary action / Save button (top-right), and a scrolling body for the form. Because the primary action lives in the fixed top bar, the on-screen keyboard SHALL NOT hide it; the form body scrolls beneath. The page SHALL NOT be draggable and SHALL NOT show a drag handle or snap points.

This replaces any keyboard-inset / visual-viewport height math on the bottom sheet: with edit forms on their own page, the bottom sheet no longer needs to resize around the keyboard.

#### Scenario: Entering edit mode on mobile

- **WHEN** the user enters edit or create mode for a tour, contact, or profile on a mobile viewport
- **THEN** the surface SHALL switch from the bottom sheet to a full-screen page
- **AND** the map SHALL NOT be visible behind the page
- **AND** the primary Save action SHALL be reachable in the top app bar regardless of keyboard state

#### Scenario: Leaving edit mode

- **WHEN** the user saves or cancels the edit/creation
- **THEN** the surface SHALL return to the bottom sheet (or close), revealing the map again

#### Scenario: A pick that needs the map collapses instead of paging

- **WHEN** an edit/create flow needs the map (e.g. picking a location)
- **THEN** the full-screen page SHALL collapse in place to a title-only bar anchored at the bottom of the screen, like a collapsed bottom sheet, so the map stays visible
- **AND** the page SHALL NOT be replaced by a bottom sheet, so the form and every unsaved value in it survive the pick
- **AND** the collapsed bar SHALL hide the cancel control and the primary action
- **AND** when the pick ends the page SHALL expand back to full screen with the form as the user left it

#### Scenario: Desktop is unaffected

- **WHEN** the user edits on a desktop viewport
- **THEN** the edit form SHALL continue to use the side drawer / dialog, not the full-screen page
