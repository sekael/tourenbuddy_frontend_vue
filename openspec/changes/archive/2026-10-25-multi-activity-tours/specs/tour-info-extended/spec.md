## MODIFIED Requirements

### Requirement: Elevation display

The tour info sheet SHALL display the elevation with the `landscape` Material Symbol icon. Every height in the app (goal, start, end, segment cards, route numbers) SHALL be written as swisstopo and SAC write it: whole metres, no thousands separator, a no-break space before `m`.

#### Scenario: Elevation present

- **WHEN** the tour has an elevation of 3079.4
- **THEN** the info sheet SHALL display it as "3079 m"

#### Scenario: No elevation

- **WHEN** the tour has null elevation
- **THEN** no elevation row SHALL be displayed

## ADDED Requirements

### Requirement: Route numbers

The tour detail SHALL show the route's climb and descent, and its distance when known, derived from the tour's data, never typed: from a GPX track with heights (horizontal distance; climb and descent counted only past a 5 m swing from the last turning point), else from the start, goal and end heights (the goal when the tour ends there). A number whose inputs are missing SHALL NOT show. No walking time SHALL be estimated.

#### Scenario: Hut to summit to valley without a track

- **WHEN** a tour starts at a hut at 2632 m, has its goal at 3079 m and ends in the valley at 1822 m
- **THEN** the detail SHALL show a climb of 447 m and a descent of 1257 m and no distance

#### Scenario: Track with heights

- **WHEN** the tour has a GPX track with heights
- **THEN** the detail SHALL show the track's distance, climb and descent instead of the point heights' numbers

#### Scenario: Start height missing

- **WHEN** the tour has no start height and no track
- **THEN** no climb or descent SHALL show

### Requirement: Point icons match the form

The start, goal and end of a tour SHALL use the same icons wherever they show — form, detail rows and map markers: a ring for the start, a flag for the goal, a chequered flag for the end. No house glyph SHALL mark a start, since a house marks a hut on swisstopo maps.

#### Scenario: Start marker on the map

- **WHEN** a tour with a start point is open
- **THEN** its start marker SHALL carry the ring glyph and its detail row the ring icon
