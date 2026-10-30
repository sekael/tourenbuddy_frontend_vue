## REMOVED Requirements

### Requirement: Map legend in the layers panel

**Reason**: The legend below the layer tiles made the panel tall, pushing the base-map and overlay
tiles out of thumb reach on a phone; the legend button on the map already opens it on its own.

**Migration**: The legend opens from its button on the map (see "Map legend button").

## ADDED Requirements

### Requirement: Map legend button

A legend button on the map (bottom left, in the tour bar's row; hidden while the menu or a sheet
is open) SHALL open the legend; the map layers panel SHALL hold only the layer tiles. The legend
SHALL list one row per marker colour, labelled with its activities from the markers' palette, and
explain the split and grey markers, the badges, clusters and the outing chain, in every locale.

#### Scenario: Colour row lists its activities

- **WHEN** the user taps the legend button on the map
- **THEN** the legend SHALL show six colour rows, e.g. an indigo row naming skitour, splitboarding and ski mountaineering and a rock-brown row naming mountaineering and climbing

#### Scenario: Symbols explained

- **WHEN** the user opens the legend
- **THEN** it SHALL show the completed, friend and linked badges, a cluster and an outing chain, each with its meaning

#### Scenario: Layers panel stays short

- **WHEN** the user opens the map layers panel and turns on ski routes
- **THEN** the panel SHALL show the base-map and overlay tiles only, no legend
