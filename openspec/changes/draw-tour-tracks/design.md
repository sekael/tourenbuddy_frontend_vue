# Design

## Context

The swisstopo app ("Smart drawing") draws a tour as a red line with a white casing, red end dots
ringed in white, and a panel with the tour's distance, time, climb, descent, elevation profile,
undo / redo and "Fertig". Its FAQ: set points along the route by pressing on the path; drag points
to move the route. There is no public routing API behind it (geo.admin offers display, identify and
profile services, no routing), so the snapping has to happen in the client.

## Decisions

### D1 Client-side routing on vector tiles

The network comes from vector tiles the map already uses: swisstopo's base map tiles
(`ch.swisstopo.base.vt`, layer `transportation`; the official hiking network carries `sac_scale`)
and the self-hosted ski-route tiles (layer `routes`). Zoom 13 everywhere: it keeps every way at
~0.8 m precision for a quarter of zoom 14's bytes (zoom 12 is generalised too far). Tiles go
through `fetch`, so the service worker's caches and downloaded offline regions serve them.

Each leg loads the tiles around its two points (400 m plus half their distance), builds a graph and
runs A*. Lines meet where they share a vertex, and a vertex within a join distance of another line
(3 m hiking, 20 m ski) meets it at its closest point — that joins tile-cut lines, simplified
T-junctions and ski routes running side by side. A loose line end (no other line meets it) reaches
across to a way within 30 m hiking at 3× its length: the base tiles stop some streets short of the
trail they meet on the ground, and the line would otherwise run round by the next junction and back.
Unmarked ways cost 1.5× a marked trail, so a route
keeps to trails and leaves them only to reach a point. A leg over more than 30 tiles, or one the
network does not connect, is drawn straight.

Alternatives: the identify API (online only, capped results); reverse-engineering the swisstopo
app's backend (private, not ours to use); MapLibre's `querySourceFeatures` (only loaded tiles at the
current zoom, absent on the Classic base map).

### D2 What the line follows

The map's trail layers decide, as the owner asked: hiking only → hiking network; ski only → ski
routes; both → the activity (a ski-touring type without hiking/trail running → ski routes, else
hiking); none → straight lines with a hint. The map's layer menu is hidden while drawing, so the
panel carries the two layer toggles.

### D3 Steps run in order

Taps, drops and their legs run through one queue, so the undo history only ever holds finished
legs; a tap's point shows at once (faint) while its leg loads. A tapped point lands on the nearest
way within ~32 px (16 px with a mouse); farther off it stays where it was set.

### D4 Heights and the GPX file

The terrain profile service (`profile.json`, POST, LV95) returns heights for every vertex sent; the
line is densified to ≤ 25 m first, so a straight leg over a ridge still climbs it. Answers are
shared between the drawing's live numbers and the saved file, and never aborted by one caller. The
form writes a one-segment GPX (with `<ele>` when known) and hands it to the existing pick path —
upload, offline staging, suggest-mode staging, start/end filling from its ends all stay one path.

### D5 Editing an existing track

A drawing comes back exactly as drawn. Any other track (uploaded, saved) becomes a drawing whose
legs keep the line exactly and whose points are its Douglas–Peucker turning points (40 m, doubled
until ≤ 10).

### D6 Plan as tour (#352)

The route's parts become a network of their own (20 m join); the track runs from the plan's start
to the point nearest the summit and on to the plan's end. SAC's route data marks no way up or down,
only the route's climb and descent: the start is the loose end whose terrain height (height service,
one call per end) lies the climb below the summit, the end the one the descent below. A traverse
(Eggerhorn: from Binn, down to Ausserbinn) gets two ends; most routes one, so the way down is the
way up. On 150 random routes stating a different descent, 79 became traverses: 75 closer to SAC's
figures, 1 farther (mean deviation 1567 m → 187 m). Routes starting at a lift above the summit or
descending off the drawn line stay up-and-back. Without heights (offline) the start is the loose end
farthest from the goal. Parts that don't connect fall back to the longest part, run from the end
nearer the start.

### D8 A route planned twice

Saving a new tour that matches an own tour in every field the owner sets, track points included,
opens that tour with a notice instead of inserting a copy (and removes the copy's upload, unless a
tour holds that file). The fields compare client-side against the loaded tours; the tracks only when
the fields match, by points to 6 decimals (heights aside). The form writes a drawn track densified
whether or not the profile service answered, so a failed height lookup doesn't make the second plan
a different track. No schema change: an exact copy is a client concern, and a duplicate row would
be harmless to the database. Segments and tours with attachments are never copies.

### D7 On the map

The drawing and an unsaved track behind the form use the same style; the line sits with the tracks
under markers and labels, the dots on top. While drawing or while the form holds an unsaved track,
the saved track is hidden. Tour markers don't take taps while drawing (a tap sets a point there),
and double-tap zoom is off.

## Risks

- swisstopo may change the base tile schema (`sac_scale`, classes): snapping degrades to unmarked
  ways or straight lines, never breaks.
- The profile service is unauthenticated and rate-limited by swisstopo; a failure leaves the
  numbers unknown and the track without heights (route numbers fall back to point heights).
