## ADDED Requirements

### Requirement: Add-tour affordance inside the tour list sheet

`TourListSheet` SHALL render an icon-only Add-tour button in the sheet header (Material Symbols `add_location_alt`, accessible name from `tours.list.addTourAriaLabel`), positioned adjacent to the close button. Activating the button SHALL emit an `add-tour` event with no payload. The component SHALL NOT mutate any store directly — the consuming page is responsible for closing the list and entering the location-pick flow.

#### Scenario: Add-tour icon rendered in sheet header

- **WHEN** `TourListSheet` is mounted for an authenticated user
- **THEN** an icon-only Add-tour button SHALL be visible in the sheet header, adjacent to the close button
- **AND** SHALL NOT appear inside the scrollable list region

#### Scenario: Activating add-tour emits event

- **WHEN** the user activates the Add-tour button
- **THEN** `TourListSheet` SHALL emit an `add-tour` event
- **AND** SHALL NOT mutate `useToursStore` or `useMapStore`

#### Scenario: Add-tour disabled when unauthenticated

- **WHEN** the user is not authenticated
- **THEN** the Add-tour button SHALL render disabled with the existing `signInToAddToursTooltip` tooltip text

#### Scenario: Add-tour visible in both mobile and desktop layouts

- **WHEN** `TourListSheet` is rendered on a viewport below 600px AND on a viewport at or above 600px
- **THEN** the header Add-tour icon SHALL be present in both layouts
