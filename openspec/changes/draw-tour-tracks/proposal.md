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
  shows; points can be dragged; a tap on the start closes a loop; undo / redo; Cancel / Done.
- **Snapping follows the map's trail layers**: hiking trails shown → the hiking network (marked
  trails preferred, paths and small roads as fallback); ski routes shown → the ski routes; both →
  the tour's activity decides (ski touring → ski routes, hiking wins when both are picked or
  neither); none → straight lines, with a hint. The layers can be switched in the drawing panel.
- **Live numbers like the swisstopo app**: distance, time (SAC rule), climb, descent and an
  elevation profile from swisstopo's terrain profile service.
- **The drawing becomes the tour's GPX track** (with terrain heights when online), through the
  existing GPX upload / offline staging path; an existing track (drawn, uploaded or saved) can be
  edited on the map.
- **Plan as tour carries the route's line** (#352): the ski route's own line, from the start up to
  the summit, becomes the planned tour's track, with heights, so its route numbers work.
- The track section moves up the form, after the activity, and is labelled "Track".

## Capabilities

### New Capabilities

- `track-drawing`: drawing a tour's track on the map — gestures, snapping, numbers, result.

### Modified Capabilities

- `trail-lookup`: "Plan a tour from a ski route" also takes the route's line as the track.
- `gpx-tracks`: a track may come from a drawing; an unsaved track shows on the map in place of the
  saved one; the section offers drawing and editing on the map.

## Impact

- Frontend only: no schema, RLS or Worker change. Tracks are stored as GPX like uploads.
- New direct dependencies `@mapbox/vector-tile` and `pbf` (already installed as MapLibre's own).
- New network reads: swisstopo base vector tiles at zoom 13 and the self-hosted ski-route tiles
  (both already cached by the service worker), and `api3.geo.admin.ch/rest/services/profile.json`.
