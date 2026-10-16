# Spec Delta

## MODIFIED Requirements

### Requirement: Trail card placement and framing

The trail card SHALL open as a bottom sheet on mobile and a side drawer on desktop, like tour details. It SHALL open only once the lookup has resolved, with its final content. When the highlighted geometry (all candidates in the list, the chosen route in details) is not fully visible beside the card, the map SHALL move to frame it; otherwise the camera SHALL NOT move. Choosing a route from the list SHALL always move the map so that route is centred in the map area left beside the card and fills it as far as possible without any part cut off, zooming in or out as needed up to zoom 15. Selecting a tour SHALL close the trail card. The card SHALL credit swisstopo.

#### Scenario: Route hidden behind the sheet

- **WHEN** the card opens and part of the route lies under the sheet or drawer
- **THEN** the map SHALL fly so the whole route is visible beside it

#### Scenario: Route already visible

- **WHEN** a lookup opens the card on a single route that is already fully visible beside it
- **THEN** the camera SHALL NOT move

#### Scenario: Route chosen from the list

- **WHEN** the card lists several routes and the user chooses one
- **THEN** the map SHALL fly so the chosen route is centred beside the card and fills that area with nothing cut off, even if it was already fully visible
- **AND** a route larger than that area SHALL make the map zoom out until it fits

#### Scenario: Short route chosen from the list

- **WHEN** the user chooses a short route from the list
- **THEN** the map SHALL zoom in past the tour zoom (12), at most to zoom 15, to fill the area beside the card

#### Scenario: Back to the list

- **WHEN** the user goes back from a chosen route to the list and all candidates are visible beside the card
- **THEN** the camera SHALL NOT move

#### Scenario: Desktop

- **WHEN** the card opens on desktop
- **THEN** it SHALL appear as a side drawer, not a centered dialog

#### Scenario: Card opens with final content

- **WHEN** a tap finds a route
- **THEN** the card SHALL open already showing its details or list, with no placeholder text that later changes
