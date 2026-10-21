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

## ADDED Requirements

### Requirement: Direction connector for tours without a track

The system SHALL draw, for every shown tour WITHOUT a GPX track (the selected tour, or each segment of a focused outing), a thin, light straight line start → goal → end in the tour's activity marker colours (banded when several), with small arrows evenly spaced on screen along each leg pointing that way. A tour without a start SHALL get no connector.

#### Scenario: Start, goal and distinct end

- **WHEN** a tour without a GPX track and with start, goal and a distinct end is shown
- **THEN** two thin legs start → goal and goal → end appear, each with evenly spaced one-way arrows, and a leg shorter than the spacing has one arrow in its middle

#### Scenario: Round trip

- **WHEN** the tour's end equals its start
- **THEN** one leg start ↔ goal appears with a two-way arrow

#### Scenario: Coinciding points

- **WHEN** two consecutive points of the tour coincide
- **THEN** the leg between them is dropped

#### Scenario: Outing overview with a hike and a flight

- **WHEN** the overview of an outing with a hiking segment followed by a paragliding segment is open
- **THEN** the first connector is in the hiking colour and the second in the paragliding colour, matching each segment's markers

### Requirement: Outing overview start and end markers

While an outing's overview is open (no segment selected), the system SHALL show a start or end marker, in its segment's colours, at every segment start and end that is a loose end of the chain: the first start, the last end, and both sides of a gap. A point SHALL get no marker where the chain hands over (a start on the previous segment's finish, an end on the next segment's start), on any goal, or where a marker already stands.

#### Scenario: Overview of a hut-to-summit outing

- **WHEN** the overview of an outing starting in the valley and ending at a different village is open
- **THEN** a start marker shows in the valley and an end marker at the village

#### Scenario: Reordered into a gap

- **WHEN** the segments are ordered so that segment 1 ends in one village and segment 2 starts in another
- **THEN** an end marker shows at the first village and a start marker at the second, with no line ending unmarked
