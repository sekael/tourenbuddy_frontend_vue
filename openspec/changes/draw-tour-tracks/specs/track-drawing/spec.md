## Purpose

Drawing a tour's track on the map from the tour form, the way the swisstopo app draws a tour: points
set by tapping, the line following the trails the map shows, live numbers, and the result saved as
the tour's GPX track.

## ADDED Requirements

### Requirement: Draw a track from the tour form

The tour form's track section SHALL offer "Draw on map" when the tour has no track and "Edit on map"
when it has one, in create, edit and suggest mode. Drawing SHALL collapse the form like a point pick
and show the map with a drawing panel; Cancel SHALL return to the form unchanged, Done SHALL return
with the drawing as the tour's track.

#### Scenario: Drawing a new tour's track

- **WHEN** the user creates a tour, taps "Draw on map", sets points on the map and taps Done
- **THEN** the form SHALL show the track as "Drawn track · <distance>" and save it with the tour

#### Scenario: Cancel keeps the form

- **WHEN** the user draws some points and taps Cancel
- **THEN** the form SHALL return with every field and the previous track as they were

#### Scenario: Done needs a line

- **WHEN** fewer than two points are set, or a leg is still loading
- **THEN** Done SHALL be disabled

### Requirement: Setting points

A tap on the map SHALL set a point and the line SHALL run to it from the previous point. A point
SHALL land on a way of the followed network within about 32 screen pixels (16 with a mouse, never
more than 250 m): of the ways about as near as the nearest, the one cheapest to reach, so the line
never runs past the point and back. Farther off it SHALL stay where it was set, its leg SHALL be
straight and the panel SHALL say no trail is within reach.

#### Scenario: Tap on a trail

- **WHEN** hiking trails are shown and the user taps 10 m beside a trail
- **THEN** the point SHALL lie on the trail and the leg SHALL follow it from the previous point

#### Scenario: Tap in open terrain

- **WHEN** the user taps where no way lies within reach
- **THEN** the point SHALL stay there, its leg SHALL be straight and the panel SHALL say why

#### Scenario: Tap between a road and a side path

- **WHEN** the tap lies between the road the line comes along and a side path joining it farther on
- **THEN** the point SHALL land on the road, without the line running to the side path's end and back

### Requirement: Moving points, loops and undo

A point SHALL be draggable with a finger or the mouse, showing straight legs while held and
following the network again when let go. A tap on the start of a line with two or more points SHALL
close a loop back to it. Undo and redo SHALL step through every set, move and loop.

#### Scenario: Drag a point

- **WHEN** the user drags a point and lets go
- **THEN** both its legs SHALL follow the network to its new place, and undo SHALL put it back

#### Scenario: Close a loop

- **WHEN** the line has three points and the user taps its start
- **THEN** a last leg SHALL run back to the start

### Requirement: Map taps while drawing

While drawing, tour markers SHALL not take taps (a tap on one sets a point there) and double-tap
zoom SHALL be off; panning and pinch zoom SHALL work as usual.

#### Scenario: Tap on a tour marker

- **WHEN** the user taps a tour's marker while drawing
- **THEN** a point SHALL be set there and no tour SHALL open

### Requirement: The line follows the shown trail layer

The line SHALL follow the hiking network when only hiking trails are shown, the ski routes when only
ski routes are shown, and straight lines when neither is shown. The hiking network SHALL prefer
marked trails and use other paths and small roads only to reach a point.

#### Scenario: No layer shown

- **WHEN** neither layer is shown
- **THEN** legs SHALL be straight and the panel SHALL say to turn on hiking trails or ski routes

#### Scenario: Trails can't load

- **WHEN** the network's tiles can't be had (offline, never cached) or the points lie too far apart
- **THEN** the leg SHALL be straight and the panel SHALL say why

### Requirement: The activity decides with both layers

With both layers shown the line SHALL follow the ski routes when the tour's activities include ski
touring, splitboarding or ski mountaineering and not hiking or trail running, else the hiking
network.

#### Scenario: Both layers, ski tour

- **WHEN** both layers are shown and the tour's activity is ski tour
- **THEN** the line SHALL follow the ski routes

#### Scenario: Both layers, hiking and ski tour

- **WHEN** both layers are shown and the activities are hiking and ski tour
- **THEN** the line SHALL follow the hiking trails

### Requirement: The panel names what the line follows

The drawing panel SHALL show the two trail layer toggles, switching the map's layers, and say what
the line follows — and that the activity decided, when both layers are shown. While drawing, the
trail layers SHALL show faded so the drawn red line stands out from the red hiking trails.

#### Scenario: Switching layers while drawing

- **WHEN** the user turns on ski routes in the panel while only hiking trails were shown
- **THEN** the map SHALL show both layers and the panel SHALL say which one the line follows

### Requirement: Live numbers and profile

The drawing panel SHALL show the line's distance, an estimated time, climb and descent, and an
elevation profile, updating after every change. Heights SHALL come from swisstopo's terrain profile
along the line; until they arrive, or offline, climb and descent SHALL show as unknown and the
profile area SHALL say so. The panel SHALL keep its height from the first tap on.

#### Scenario: Numbers after two points

- **WHEN** the user has set two points along a trail and the profile has loaded
- **THEN** the panel SHALL show distance, time, climb, descent and the profile with its lowest and highest height

### Requirement: Time estimate

The time SHALL follow the SAC rule: 4 km/h on the flat, 300 m/h up and 500 m/h down, the shorter of
horizontal and vertical time counting half; for a ski-touring activity the climb SHALL go at 400 m/h
and the descent at 1500 m/h.

#### Scenario: A climb on foot

- **WHEN** the line is 4 km long with 600 m of climb on a hiking tour
- **THEN** the panel SHALL show 2 h 30 min

### Requirement: Drawn track saved as GPX

On Done the drawing SHALL become a one-segment GPX track with a terrain height per point when the
profile service answers (straight stretches densified to at most 25 m), and without heights
otherwise. It SHALL take the same path as a picked GPX file: uploaded at once (staged offline),
filling an empty start and end from its ends, Save waiting until it is ready.

#### Scenario: Offline drawing

- **WHEN** the user draws offline and taps Done
- **THEN** the track SHALL be staged without heights and upload with the tour on reconnect

### Requirement: Editing an existing track

"Edit on map" SHALL open the drawing on the current track: a drawing from this form exactly as
drawn; an uploaded or saved track with its line unchanged and at most 10 of its turning points as
draggable points.

#### Scenario: Editing a saved track

- **WHEN** the user edits a tour with a saved track and taps "Edit on map"
- **THEN** the drawing SHALL show that track with draggable points, and Done without changes SHALL keep its line
