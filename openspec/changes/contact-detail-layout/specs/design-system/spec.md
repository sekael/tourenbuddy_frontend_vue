## MODIFIED Requirements

### Requirement: Views carry no redundant chrome or dead space

Every overlay view SHALL have exactly one header row holding its title, back, actions, and close. List rows SHALL show the information users scan for: tour rows SHALL show the planned date when one is set. Equivalent primary actions in page headers SHALL share one size. Scrolling content above a sheet footer SHALL fade out under it rather than being cut off at its edge.

#### Scenario: Contact detail has one header

- **WHEN** the user opens a contact from the contacts list
- **THEN** a single header shows back, the contact's name, and close, with no second header row inside the view (Edit sits in the footer)

#### Scenario: Tour rows show the date

- **WHEN** a tour with a planned date is listed
- **THEN** its row shows the date (with the year only when it is not the current year) next to any partner names

#### Scenario: Undated tours stay compact

- **WHEN** a tour has neither a planned date nor partners
- **THEN** its row is a single line

#### Scenario: Content under a footer

- **WHEN** a sheet with footer actions has more content than fits
- **THEN** the content fades out just above the footer instead of ending in a hard cut
