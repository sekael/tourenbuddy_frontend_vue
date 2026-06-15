## ADDED Requirements

### Requirement: Sheet shrinks above the on-screen keyboard

When the on-screen keyboard opens on mobile, the sheet SHALL keep its top edge anchored and shrink from the bottom so its bottom edge rests at the top of the keyboard, with its content region scrolling within the reduced height. The sheet SHALL derive the keyboard inset from the visual viewport as `K = max(0, window.innerHeight − (visualViewport.height + visualViewport.offsetTop))` — clamped to be non-negative — rather than assuming the layout viewport shrinks, and SHALL keep it current as both the `resize` and `scroll` visual-viewport events fire. The fixed sheet container SHALL be offset above the keyboard by the same inset. While the keyboard is open the drag handle SHALL be inert (no manual resize). When the keyboard closes, the sheet SHALL restore its prior resting height and offset.

With `H` = layout viewport height, `K` = keyboard inset, and `S` = the sheet's resting height before the keyboard opened (its snap height or fit-content height):

- `K = 0` → height SHALL be `S` and the container offset SHALL be `0`.
- `0 < K ≤ S` → height SHALL be `S − K` and the container offset SHALL be `K` (the sheet's top stays put; any content above the sheet, such as the map, keeps its region).
- `K > S` → height SHALL be `H − K` and the container offset SHALL be `K` (the sheet expands to the top of the screen on small devices).

#### Scenario: Keyboard opens with room for content above

- **WHEN** a sheet resting at height `S` is open and the keyboard opens with inset `K` where `K ≤ S`
- **THEN** the sheet height SHALL become `S − K`
- **AND** the sheet's top edge SHALL not move
- **AND** the content region SHALL scroll within the reduced height

#### Scenario: Keyboard taller than the sheet on a small device

- **WHEN** a sheet resting at height `S` is open and the keyboard opens with inset `K` where `K > S`
- **THEN** the sheet SHALL expand so its top edge reaches the top of the screen
- **AND** the sheet height SHALL become `H − K`

#### Scenario: Keyboard closes

- **WHEN** the keyboard closes (inset returns to `0`)
- **THEN** the sheet SHALL restore its prior resting height `S`
- **AND** the container offset SHALL return to `0`

#### Scenario: Drag is inert while the keyboard is open

- **WHEN** the keyboard is open (`inset > 0`) and the user attempts to drag the handle
- **THEN** the sheet SHALL NOT resize from the gesture
- **AND** the prior resting height SHALL be restored when the keyboard closes

### Requirement: Sheet uses its limited space efficiently

The sheet SHALL keep non-content chrome — content padding, header padding, footer padding, and the margins/gaps around the drag handle and footer action bar — compact so the maximum area is available for information, while interactive controls remain comfortably usable and visually separated. The comfortable size of each control is a per-control design decision judged by visual inspection; this requirement does NOT mandate a fixed numeric touch-target floor. A control's visible size SHALL equal its hit area — no invisible hit extensions, which produce confusing behavior. Visual grouping (dividers, borders, and inter-element `gap`) SHALL remain perceptible so the layout stays readable, not cramped.

#### Scenario: Content uses the available width

- **WHEN** the sheet renders content on a narrow mobile viewport
- **THEN** the content horizontal padding SHALL be compact (not the widest spacing token)
- **AND** more content width SHALL be available than with the previous padding

#### Scenario: Compact without becoming cramped

- **WHEN** non-content padding, margins, and gaps are trimmed
- **THEN** interactive controls SHALL remain comfortably tappable with hit area equal to their visible size
- **AND** grouping separation between elements SHALL remain visible
