## MODIFIED Requirements

### Requirement: Full-screen viewer with horizontal flip

The system SHALL provide a full-screen viewer that displays the selected attachment and SHALL allow the user to flip between all attachments of the tour via horizontal swipe and on-screen left/right controls. Images SHALL be rendered with a native `<img>`; PDFs SHALL be rendered using `pdfjs-dist` with page-by-page navigation. The viewer's top chrome (filename, download button, close button) SHALL clear the device status bar in standalone PWA mode on both iOS and Android by honoring `env(safe-area-inset-top)`. The viewer's bottom chrome (dots indicator, PDF page navigation) SHALL clear the home indicator / gesture navigation bar by honoring `env(safe-area-inset-bottom)`. Side navigation controls SHALL honor `env(safe-area-inset-left)` / `env(safe-area-inset-right)`. The viewer SHALL also close on a downward swipe gesture past a distance threshold; gesture classification SHALL choose the dominant axis so a clearly horizontal swipe still navigates between attachments, and an upward swipe SHALL NOT close the viewer.

#### Scenario: Flip between files

- **WHEN** the viewer is open on attachment 1 of N
- **THEN** the user SHALL be able to swipe horizontally or press a control to move to attachment 2, and the new attachment SHALL render full-screen

#### Scenario: Image rendering

- **WHEN** the active attachment is an image
- **THEN** it SHALL be rendered using `<img>` fitted to the viewport

#### Scenario: PDF rendering

- **WHEN** the active attachment is a PDF
- **THEN** the viewer SHALL render it using `pdfjs-dist` and SHALL provide page navigation when the PDF has more than one page

#### Scenario: PDF dependency loaded lazily

- **WHEN** a tour view renders without opening the viewer for a PDF
- **THEN** `pdfjs-dist` SHALL NOT be loaded into the main bundle

#### Scenario: Close button clears status bar on iOS and Android PWA

- **WHEN** the viewer is opened in a standalone PWA on iOS or Android where `env(safe-area-inset-top)` is non-zero
- **THEN** the header (including the close button) SHALL be offset by at least the safe-area top inset so the close button is fully tappable and not occluded by the system status bar

#### Scenario: Bottom chrome clears home indicator / gesture bar

- **WHEN** the viewer is opened on a device where `env(safe-area-inset-bottom)` is non-zero
- **THEN** the dots indicator (and PDF page navigation, when shown) SHALL be offset by at least the safe-area bottom inset

#### Scenario: Swipe down closes viewer

- **WHEN** the user performs a touch gesture whose downward vertical displacement (`dy > 0`) exceeds the close threshold AND exceeds the absolute horizontal displacement
- **THEN** the viewer SHALL emit `close` and be dismissed

#### Scenario: Swipe up does not close

- **WHEN** the user performs a touch gesture whose upward vertical displacement (`dy < 0`) exceeds the close threshold
- **THEN** the viewer SHALL NOT close

#### Scenario: Horizontal swipe still navigates

- **WHEN** the user performs a touch gesture whose absolute horizontal displacement exceeds the navigation threshold AND exceeds the absolute vertical displacement
- **THEN** the viewer SHALL navigate to the previous or next attachment and SHALL NOT close
