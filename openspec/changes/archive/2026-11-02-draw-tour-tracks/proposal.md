# Proposal

## Why

A tour's track can only come from an uploaded GPX file, so planning a route means leaving the app
for a tool that draws one. The swisstopo app lets people draw a tour on the map, the line following
the trails between the points they set. TourenBuddy users want the same, inside the tour form
(#323). And a ski route planned as a tour (`smarter-tour-creation`, "Plan as tour") arrives without
its line: the planned tour shows no track, and its climb and descent come from point heights only
(#352).

## What Changes

- **Draw a track on the map** from the tour form, when creating or editing a tour (and when
  suggesting on a friend's tour): a tap sets a point, the line runs to it along the trails the map
  shows; points can be dragged; a handle halfway along each leg pulls a new point out of it; a tap
  on the start closes a loop; "To start" returns the same way (out-and-back in one tap); undo /
  redo; close / Done.
- **Snapping follows the map's trail layers, then its ways**: hiking trails shown → marked trails
  first; ski routes shown → the ski routes first; both → the tour's activity decides (ski touring →
  ski routes, hiking wins when both are picked or neither). Every mode goes on along the base map's
  roads, forest roads and paths, and with no layer shown follows those; a line is straight only off
  every way. The layers can be switched in the drawing panel.
- **Live numbers like the swisstopo app**: distance, time (SAC rule), climb, descent and an
  elevation profile from swisstopo's terrain profile service.
- **The drawing becomes the tour's GPX track** (with terrain heights when online), through the
  existing GPX upload / offline staging path; an existing track (drawn, uploaded or saved) can be
  edited on the map.
- **Plan as tour carries the route's line** (#352): the ski route's own line, from the start up to
  the summit and down to its end (back the same way, or on to another valley for a traverse),
  becomes the planned tour's track, with heights, so its route numbers match the route's. A marked
  ski route can also be tapped while picking a new tour's goal.
- **No exact copies**: saving a tour identical to one the user already has (a route planned twice)
  opens that tour instead of saving a second.
- **Messages clear the location picker**: toasts sit above its search and buttons.
- **Route numbers from the track only**: nothing shows while a track loads (no start-goal estimate
  first), and a track without heights takes the terrain's.
- **Legend out of the layers panel**: it keeps its own button, so the layer tiles stay in reach.
- **The form leads with the route**: after the goal and activity comes the route, with "Draw on
  map" as its main action; start and end fold into one "Set by hand" row until a pick, a suggestion
  or the track sets them, and points the track set follow it when it is redrawn.
- **Ski route card in the app's design**: led by the summit's altitude like a tour's details, with
  the grade badge, ascent time and route numbers, and "Plan as tour" and the SAC link as full
  buttons.

## Capabilities

### New Capabilities

- `track-drawing`: drawing a tour's track on the map — gestures, snapping, numbers, the user's
  pace (tortoise to hare) for the time, result.

### Modified Capabilities

- `trail-lookup`: "Plan a tour from a ski route" also takes the route's line as the track; routes
  are tappable during the new-tour goal pick; the route card's details follow the tour sheet's
  layout.
- `tour-form-extended`: the route comes before start and end, which fold away until set; points
  the track set follow it.
- `tour-info-extended`: route numbers come from the track (terrain heights when it has none),
  never from point heights while it loads; a tour with a track shows its estimated time at the
  user's pace.
- `map-legend`: the legend leaves the layers panel and opens from its own button only.
- `gpx-tracks`: a track may come from a drawing; an unsaved track shows on the map in place of the
  saved one; the section offers drawing and editing on the map.
- `tours`: an exact copy of an own tour is not saved twice.
- `design-system`: floating toasts also clear the location picker's dock.
- `name-suggestion`, `elevation-lookup`: a point's name and height wait under one skeleton and
  show together, no spinner.

## Impact

- One schema change: `user_profile.pace` (numeric 0.5–1.5, default 1.0), so the pace follows the
  account (migration `20261102062850_user_profile_pace.sql`; existing grants and own-row policies
  cover it). No RLS or Worker change. Tracks are stored as GPX like uploads.
- New direct dependencies `@mapbox/vector-tile` and `pbf` (already installed as MapLibre's own).
- New network reads: swisstopo base vector tiles at zoom 13 and the self-hosted ski-route tiles
  (both already cached by the service worker), and `api3.geo.admin.ch/rest/services/profile.json`.
