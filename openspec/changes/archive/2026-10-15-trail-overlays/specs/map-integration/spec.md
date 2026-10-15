# Spec Delta

## MODIFIED Requirements

### Requirement: Map style switching

The map SHALL support switching between two Swisstopo styles: "Base" (the `ch.swisstopo.basemap.vt` vector style) and "Classic" (WMTS raster style loaded from a local JSON file). The style SHALL be chosen in the "Base map" section of the map layers panel. Switching styles needs the network: offline, the "Base map" section SHALL be disabled with a "Needs a connection" hint while the rest of the panel stays usable. Switching styles SHALL NOT change which trail overlays are on.

#### Scenario: Switch to classic style

- **WHEN** the user selects "Classic" in the "Base map" section of the map layers panel
- **THEN** the map SHALL load the WMTS style from `public/swisstopo_wmts_style.json` and re-render

#### Scenario: Switch back to base style

- **WHEN** the user selects "Base" in the "Base map" section of the map layers panel
- **THEN** the map SHALL revert to the vector tile style URL

#### Scenario: Overlays kept across a switch

- **WHEN** a trail overlay is on and the user switches the style
- **THEN** the overlay SHALL still be on and render after the new style loads

#### Scenario: Offline

- **WHEN** the device is offline and the user opens the map layers panel
- **THEN** the base-map options SHALL be disabled with a "Needs a connection" hint and the current style SHALL stay loaded
