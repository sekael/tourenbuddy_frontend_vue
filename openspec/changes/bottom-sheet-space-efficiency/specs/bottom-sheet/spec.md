## ADDED Requirements

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
- **THEN** the surface SHALL fall back to the collapsed bottom sheet so the map stays visible, rather than the full-screen page

#### Scenario: Desktop is unaffected

- **WHEN** the user edits on a desktop viewport
- **THEN** the edit form SHALL continue to use the side drawer / dialog, not the full-screen page

### Requirement: Sheet uses its limited space efficiently

The sheet SHALL keep non-content chrome — content padding, header padding, footer padding, and the margins/gaps around the drag handle and footer action bar — compact so the maximum area is available for information, while interactive controls remain comfortably usable and visually separated. The comfortable size of each control is a per-control design decision judged by visual inspection; this requirement does NOT mandate a fixed numeric touch-target floor. A control's visible size SHALL equal its hit area — no invisible hit extensions, which produce confusing behavior. Visual grouping (dividers, borders, and inter-element `gap`) SHALL remain perceptible so the layout stays readable, not cramped.

The sheet's maximum height SHALL be 70% of the viewport height (expanded snap = `innerHeight * 0.7`; CSS ceiling `max-height: 70vh`), so the map always retains at least 30% of the screen.

#### Scenario: Sheet caps at 70% so the map keeps 30%

- **WHEN** the sheet is at its tallest (expanded snap, or fit-content with content taller than the cap)
- **THEN** the sheet SHALL occupy at most 70% of the viewport height
- **AND** at least 30% of the viewport SHALL remain for the map

#### Scenario: Content uses the available width

- **WHEN** the sheet renders content on a narrow mobile viewport
- **THEN** the content horizontal padding SHALL be compact (not the widest spacing token)
- **AND** more content width SHALL be available than with the previous padding

#### Scenario: Compact without becoming cramped

- **WHEN** non-content padding, margins, and gaps are trimmed
- **THEN** interactive controls SHALL remain comfortably tappable with hit area equal to their visible size
- **AND** grouping separation between elements SHALL remain visible
