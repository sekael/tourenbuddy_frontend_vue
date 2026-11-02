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

The map's trail layers set what the line follows first, as the owner asked: hiking only → marked
trails; ski only → ski routes; both → the activity (a ski-touring type without hiking/trail running
→ ski routes, else hiking). Every mode also follows the base map's roads, forest roads and paths
(the `WALKABLE` classes), so a ski route runs on along the forest road to the car park; with no
layer shown those ways are the network. A leg is straight only off every way, over a far jump, or
where no tile loads. The map's layer menu is hidden while drawing, so the panel carries the two
layer toggles; they choose what comes first and no longer switch snapping off (owner, round 4).

| Mode | cost 1 | cost 1.5 |
|------|--------|----------|
| hiking | marked trails (`sac_scale`) | other ways |
| ski | ski routes | every base way, trails included |
| none | every base way | — |

The base tiles are cached as lines with a "marked" flag, and the cost is set per mode, so switching
a layer reuses them. Ski lines keep their 20 m join (routes running side by side, a route's end at
a road), base ways their 3 m; the join is the line's own, so two paths 10 m apart don't merge.

A way that only connects far round is no way to follow (owner, after review round 2: a 1 km hop
became a 4.6 km detour round a dead end). A leg along the ways longer than 2.5× the straight
distance and over 500 m more is drawn straight, as off the ways; the user steers it with another
tap. The 500 m floor keeps a few switchbacks on their path.

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

### D9 The form leads with the route

Creation starts at the goal, as before: the user sets it deliberately (owner, round 4 — a track's
highest point is no goal: huts, lakes, passes). The form then asks name, goal, activities, and
the route: track, start, end and grade. The activity sits above the route because, with both
layers shown, it decides what the line follows; the grade moves below it (it is the route's
difficulty) so the track follows the activity chips directly — on a 360 px phone the grade field
pushed "Draw on map" a screen further down. The route section offers "Draw on map" as its main
action, "Upload GPX" beside it.

Start and end fold into one row ("Start and end · Set by hand") while both are empty, so a
drawing user skips them; a pick, a suggestion or a track opens them. A point the track set follows
the track: redrawn or replaced, the track moves it to its new end; a point set or changed by hand,
or a tour's saved point, never moves (the "GPX fills empty points" rules still apply to which
end is set); an end the new track keeps keeps its name, unlooked-up. A drawing's ends are set (and
named) when Done is tapped, while its heights still load. A planned ski route sends no start pick
any more: its track sets start and end like any other. Removing the track leaves the points.

Round 1 of the review measured the phone's first screen: at 360×740 "Draw on map" fell 90 px
below it. The goal card now holds title, coordinates and "Change" on one line and its height
beside its label, and the name and goal go without a "Location" heading (the dialog's title heads
them); replacing the GPX moved from a bare icon on the track's tile to a labelled button beside
"Edit on map".

Round 2 still saw names fill in late (owner: no blank, a skeleton until settled). A point's name
and height now show together: while either lookup runs, both fields hold a quiet pulsing bar in
place of their text — no spinner, no "Loading" hint — and their values appear at once when both
have answered or failed. A field being typed in drops its bar. The value under the bar is
cleared as before, so a save mid-lookup never keeps the previous point's name.

### D10 The ski route card

The card reads like a tour's details: the ski-tour disc and the target's altitude as headline, the
route name, then a meta line with the grade badge, the ascent time and the route numbers (↑ ↓) —
the same `GradeBadge` and `RouteNumbers` the tour sheet uses. "Plan as tour" and "Open in the SAC
portal" are full buttons side by side (stacked when they don't fit), the swisstopo credit under
them. The list's rows take the grade badge too.

### D11 The user's pace

The owner asked for the swisstopo app's personal pace (a tortoise → hare slider in its tour
settings, kept for later tours): the time is the rule's time divided by the pace, 50–150 % in
10 % steps. The panel's time is its button — a tap opens the slider row under the numbers, another
closes it; the closed time's icon turns tortoise or hare for a pace off 100 %, so a changed setting
never hides (a "120 %" beside it wrapped the numbers on a 360 px phone).
The pace is kept per device, as the map's layers are (`core/composables/use-pace.ts`, one ref for
the map and the tours features), and applies to every time the app shows.

This revises multi-activity-tours D19 ("no walking time: pace differs too much between hiking, ski
touring and flying"): a saved track now shows its time in the form's track tile and the tour
detail — the number the drawing showed. The objection is met by the activity and the pace: on skis
for ski touring (the rule's 400 m/h up), none for lifts, bikes or climbing alone, and none where a
way is flown (a flight's drop is no legwork). Without a track distance there is still no time.

Review round 1 (persona) asked three things of it. A time that follows today's pace must say so:
wherever a time shows outside the panel (form, detail, ski route card) a pace off 100 % sits beside
it as tortoise or hare and percent. The ski route card's time is SAC's ascent time; it now says so
("Ascent 4:30 h") and takes the pace too, so it reads next to the planned tour's whole-day time. The
slider opens in the status line's place (both rows 44 px), so the panel never grows over the track;
times read as SAC writes them ("2:05 h"), which keeps the four figures on one 360 px line while the
time changes under the finger; the time button is a 44 px target around a 32 px pill.

*Alternative:* a profile column, the pace on every device — a migration for a setting the swisstopo
app keeps per device too; added when users ask for it.

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
