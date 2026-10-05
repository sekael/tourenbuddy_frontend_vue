## MODIFIED Requirements

### Requirement: Stable spotlight popover placement

For each step the system SHALL position the popover so that it does not visibly jump after first appearing, does not overlap its own spotlight cutout, and is not clipped by the viewport edges on either mobile or desktop. The system SHALL reveal the spotlight before the popover and position the popover only once the target's layout has settled. A step MAY declare a per-step popover side so a target sitting low in a tall surface does not overflow the screen bottom (where it would otherwise be flipped up into the top control banner). A spotlit target SHALL stay fully visible inside its cutout, including parts that extend beyond its parent element.

#### Scenario: Surface whose layout settles after opening

- **WHEN** a step targets a surface whose content changes after it opens (e.g. the profile overview's notification summary filling in once the notification preferences load)
- **THEN** the popover is positioned against the settled layout and does not jump to a corrected position after appearing

#### Scenario: Spotlight precedes the popover

- **WHEN** a step is staged and its target has settled
- **THEN** the spotlight cutout is shown first and the popover is attached afterwards, against the final target rect

#### Scenario: Target sits low in a tall surface

- **WHEN** a step's target is near the bottom of a tall surface such that a below-target popover would overflow the viewport
- **THEN** the step's declared side keeps the popover within the viewport and clear of the top control banner

#### Scenario: Target overflows its parent

- **WHEN** a step spotlights the base-map options, which unfold outside the box of the menu entry that holds them
- **THEN** the options remain fully visible inside the spotlight cutout
