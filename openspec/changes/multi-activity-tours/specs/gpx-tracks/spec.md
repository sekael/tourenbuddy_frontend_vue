## MODIFIED Requirements

### Requirement: Track rendering with darker tour-type color

The system SHALL render the selected tour's GPX track on the map as a polyline coloured with darker variants of the tour types' marker colours, defined by a sibling map `TOUR_TYPE_TRACK_COLORS`. The track color MUST be visually darker than the corresponding tour marker so the marker remains distinguishable when stacked over its track. A defined fallback color SHALL be used when the tour has no type. When the tour's types map to more than one distinct track colour, the track SHALL cycle through those colours in bands along its length, fading smoothly from one band into the next.

#### Scenario: Selecting a hiking tour

- **WHEN** a user selects a tour of type `hiking` that has a track
- **THEN** the gpx-track layer renders the polyline using `TOUR_TYPE_TRACK_COLORS.hiking`, which is darker than `TOUR_TYPE_COLORS.hiking`

#### Scenario: Switching selection

- **WHEN** the selected tour changes from a skiing tour to a paragliding tour
- **THEN** the rendered track updates to the paragliding track color without reloading the map style

#### Scenario: Unknown tour type

- **WHEN** a tour has no activity type
- **THEN** the track renders in the defined fallback color

#### Scenario: Activity type changed on selected tour

- **WHEN** the selected tour's types are updated (e.g. from `splitboarding` to `mountaineering`, or from none to a defined type)
- **THEN** the rendered track colours update immediately to the new types' `TOUR_TYPE_TRACK_COLORS` entries without a page refresh, even when the parsed GeoJSON is served from the in-memory cache

#### Scenario: Ski tour and hike track fades between colours

- **WHEN** a user selects a tour of types `skitour` and `hiking` that has a track
- **THEN** the track alternates between the winter and summer track colours in bands along its length, each band fading smoothly into the next

#### Scenario: Same-colour types render one colour

- **WHEN** a tour's types all share one track colour (e.g. `skitour` and `splitboarding`)
- **THEN** the track renders in that single colour with no bands

### Requirement: Lazy fetch and caching of GPX data

The system SHALL fetch and parse a tour's GPX file on demand when the tour is selected on the map, and SHALL cache parsed GeoJSON in memory for the session to avoid duplicate work.

#### Scenario: First selection

- **WHEN** a tour with `gpx_filepath` is selected for the first time in a session
- **THEN** the client requests a signed URL, downloads the file, parses it, caches the result, and renders the track

#### Scenario: Re-selection

- **WHEN** the same tour is re-selected later in the session
- **THEN** the cached GeoJSON is reused without re-downloading, and the track colouring is recomputed from the tour's current types before the track is shown, so colour always reflects the latest activity types

#### Scenario: Tour without track

- **WHEN** a tour with `gpx_filepath = null` is selected
- **THEN** the gpx-track layer renders no polyline and no network request is made
