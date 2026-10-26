## Purpose

Explain what the map's tour markers mean (activity colours, split markers, badges, clusters and
outing chains) without leaving the map.

## ADDED Requirements

### Requirement: Map legend in the layers panel

The map layers panel SHALL show a legend below its base-map and overlay sections, and a legend button on the map (at the bottom left, in the tour bar's row so it covers no further map; hidden while the menu or a sheet is open) SHALL open the same legend on its own. The legend
SHALL list one row per marker colour, labelled with the activities that use it, derived from the
same palette the markers use, so a palette change is reflected without editing the legend. It
SHALL also explain:
- a split marker (several activities)
- the grey marker (no activity)
- the completed badge
- the friend badge
- the linked badge
- a cluster with its count
- the outing chain line

All legend text SHALL be localised in every locale. The panel SHALL scroll when it is taller
than the viewport.

#### Scenario: Colour row lists its activities

- **WHEN** the user opens the map layers panel
- **THEN** the legend SHALL show a blue row naming every winter activity and a red row naming every summer activity on foot

#### Scenario: Symbols explained

- **WHEN** the user opens the map layers panel
- **THEN** the legend SHALL show the completed, friend and linked badges, a cluster and an outing chain, each with its meaning

#### Scenario: Legend from the map

- **WHEN** the user taps the legend button on the map
- **THEN** the legend SHALL open without going through the menu
