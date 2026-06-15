## MODIFIED Requirements

### Requirement: Bottom sheet height is user-adjustable via drag handle

The drag handle SHALL act as a resize control. The user SHALL be able to drag the handle vertically (touch or pointer) to change the sheet height. Sheet height SHALL be clamped between a peek height (header-only) and a maximum of 60vh. Dragging up SHALL grow the sheet; dragging down SHALL shrink it. While the on-screen keyboard is closed the maximum height SHALL never exceed 60vh so the underlying map remains partially visible; the full-page keyboard mode is the sole exception (see "Sheet expands to full screen above the on-screen keyboard"), and the drag handle is inert there.

#### Scenario: Drag up grows the sheet

- **WHEN** the sheet is at its default height
- **AND** the user presses the drag handle and moves the pointer up by 100px
- **THEN** the sheet height SHALL increase by approximately 100px
- **AND** the sheet height SHALL NOT exceed 60vh

#### Scenario: Drag down shrinks the sheet

- **WHEN** the sheet is at its default height
- **AND** the user presses the drag handle and moves the pointer down by 100px
- **THEN** the sheet height SHALL decrease by approximately 100px
- **AND** the sheet height SHALL NOT shrink below the peek height (header only)

#### Scenario: Hard 60vh ceiling

- **WHEN** the user drags the handle further up after the sheet has already reached 60vh
- **THEN** the sheet height SHALL remain at 60vh

## ADDED Requirements

### Requirement: Sheet expands to full screen above the on-screen keyboard

When the on-screen keyboard opens on mobile, the sheet SHALL expand to a full page that fills the entire screen above the keyboard — covering any content behind it (such as the map) — so all available real estate is given to the edit/input form. The sheet SHALL derive the keyboard inset from the visual viewport as `K = max(0, window.innerHeight − (visualViewport.height + visualViewport.offsetTop))` — clamped to be non-negative — rather than assuming the layout viewport shrinks, and SHALL keep it current as both the `resize` and `scroll` visual-viewport events fire. The fixed sheet container SHALL be offset above the keyboard by the same inset so the sheet's bottom edge rests exactly at the top of the keyboard. While in this full-page mode the sheet SHALL drop the chrome that would otherwise leave gaps over the covered content — its max-height cap, top corner radius, and side/top borders — and the drag handle SHALL be inert (no manual resize). When the keyboard closes, the sheet SHALL restore its prior resting height and the offset SHALL return to `0`, revealing the map again.

With `H` = layout viewport height, `K` = keyboard inset, and `S` = the sheet's resting height before the keyboard opened (its snap height or fit-content height):

- `K = 0` → height SHALL be `S` and the container offset SHALL be `0`.
- `K > 0` → height SHALL be `H − K` and the container offset SHALL be `K`. Because the container's bottom edge sits `K` above the viewport bottom (at the keyboard's top), a sheet of height `H − K` reaches the top of the screen (`y = 0`) with no gap above or below.

#### Scenario: Keyboard opens

- **WHEN** a sheet resting at height `S` is open and the keyboard opens with inset `K > 0`
- **THEN** the sheet height SHALL become `H − K`
- **AND** the sheet SHALL fill the screen from the top edge down to the top of the keyboard, covering the map
- **AND** the content region SHALL scroll within the full-page height

#### Scenario: Keyboard closes

- **WHEN** the keyboard closes (inset returns to `0`)
- **THEN** the sheet SHALL restore its prior resting height `S`
- **AND** the container offset SHALL return to `0`
- **AND** the map SHALL be revealed again behind the sheet

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
