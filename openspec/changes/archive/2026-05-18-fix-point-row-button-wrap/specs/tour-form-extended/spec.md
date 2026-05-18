## ADDED Requirements

### Requirement: Point picker action rows stay within their bounded section

The action button row inside each `.point-section` (goal, start, end) SHALL remain visually contained within its bounded background across all supported viewport widths (down to ~320 CSS px). When the combined intrinsic width of the action buttons exceeds the available row width, the buttons SHALL wrap onto additional lines rather than overflowing the section background.

#### Scenario: End-point section on a narrow mobile viewport

- **WHEN** the user opens the tour form on a viewport ≤ 360 CSS px wide with a start point set and no end point set
- **THEN** the "Add End Point" and "Round Trip" buttons SHALL both render fully inside the end-point section's bounded background, wrapping onto a second line if they do not fit side by side

#### Scenario: End-point section on a wide viewport

- **WHEN** the user opens the tour form on a viewport wide enough to fit both action buttons on one line
- **THEN** the buttons SHALL render side by side on a single line as today
