## ADDED Requirements

### Requirement: DialogWindow pins an optional footer

`DialogWindow` SHALL accept an optional `footer` slot rendered below the scrolling content region,
outside it, so its actions stay visible however long the content is. Content scrolling above the
footer SHALL fade out under it rather than end in a hard cut. A collapsed dialog SHALL NOT show
the footer.

#### Scenario: Footer stays put
- **WHEN** a dialog with a footer has more content than fits
- **THEN** the content scrolls and the footer stays visible below it, with the content fading out just above the footer

#### Scenario: No footer while collapsed
- **WHEN** the dialog is collapsed
- **THEN** the footer is not shown
