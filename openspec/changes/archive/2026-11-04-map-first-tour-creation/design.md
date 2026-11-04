# Design

## D1 — One route planner for every creation pick

A new map overlay, `route-planner.vue`, owns the three points of the stage being planned. A tap on the
map sets the active point and moves on (start → goal → end); a search result sets it with its name; a
point can be dragged (mouse, pen or finger — the same gesture code as the track drawer). Each set point
looks up its name (unless the search named it) and height at once; the panel shows the three steps
with name and height, the climb and descent of the legs it knows (`pointMetrics`), and the actions:
Skip (start), Round trip (end, with a start: a tonal button with the drawer's "back to the start" mark,
which the end row then wears), Remove (a set start or end), Continue / Done.

Why tap, not the crosshair: three points in a row are three aim-and-confirm cycles with the crosshair;
a tap sets each in one move, and dragging fixes the aim. The crosshair picker stays for edits, where one
point changes at a time.

A tap on a marked ski route (ski layer on, marking zoom, a new tour) still opens its card to plan it with
its line (#323); closing the card returns to the planner.

## D2 — The planner hands its lookups to the form

`PointPick` gains `elevation`; the form's `applyPick` uses a given name / height instead of asking
Swisstopo again. `pick` accepts a list, so the planner's Continue hands all points at once. Points that
are still loading go without, and the form looks them up as before.

## D3 — The form is the stage's truth after Continue

Once the form exists, it owns names, heights and the GPX-derived ends. Reopening the planner from the
form reads the form's current points (`route()` exposed); Done hands back only the points that moved.
Removing stays in the form (its delete buttons) and in the planner (Remove) — a removal in the planner
hands the form `location: null` for that point.

## D4 — Stages are mounted forms

Each stage of a multi-day creation is its own `TourForm`, kept mounted (shown one at a time), so every
stage keeps its own unsaved edits, GPX upload and staged attachments; Cancel runs each form's cleanup.
Save validates every stage (a stage with an error comes to the front) and creates them in order into a
new outing (or after the anchor's outing for "Add segment" / split). The outing is minted on save only,
so cancelling leaves nothing behind.

`nextSegmentSeed` (now taking a stage still in its form, with its goal) seeds the next stage:
same activities, legs, partners, visibility, seasons; dated the day after the previous stage's last day;
starting at its end, else its goal, with name and height.

## D5 — Split into daily stages

A span of n days becomes day 1 (the end date cleared) plus the planner for day 2, titled "Day 2 of n";
each further "+ Next day" continues the count. A saved standalone tour (or an outing's last segment)
with a span offers the same from its detail: on save its end date is cleared and it becomes segment 1.
Its track stays on day 1 — a track can't be split by day without knowing the nights.

## D6 — Desktop side drawer

The creation overlay uses `SideDrawer` on desktop (as the tour details do) instead of `DialogWindow`;
the map's covered area already accounts for an open drawer, so framing lands beside it. While the
planner or the track drawer runs the drawer stays open; its form is disabled until they finish.

## D7 — The draft outing on the map

The map store carries `previewStages` (goal, start, end, activities, legs, drawn line per stage). With no
tour or outing open, the map draws them like an outing: goals in the preview tone, start / end / handover
rings via `outingDetailMarkers` (draft tone), straight legs via the connector layer, drawn lines via the
draft track layer.

## D8 — The route step follows the ways

The planner joins its points the way the track drawer joins taps: `useLegRouter` (A* over the ways in the
tiles around each leg, shared with the drawer) on the shown trail layer, else the activities' network,
else the base map's ways. A stop (hut, summit) stays exactly where it was set and joins a way up to
`STOP_SNAP_M` away; farther, or a detour, its leg goes straight. A "Den Wegen folgen" switch turns it off
(straight lines, climb from the points' heights). A leg shows straight while it loads or a point is held;
Continue / Next day wait for pending legs. Offline (no ways) the legs go straight and the step says why.
A stop with no way that near (a summit above the trail's end) tries again out to 1 km: the leg follows
the way to its nearest point and goes straight only for the last bit. A leg that still finds no way
shows straight and the switch's row turns to a warning ("no path for part of it"); the track drawer's
status line says the same for a leg of its own that found no way.
Off the ways for more than half the straight distance (the bits to the first way and from the last
together), the ways don't lead there and the leg goes straight from point to point, never bent at a way
on the side: a ridge to its summit doesn't dive to the valley path below. How it all works, step by
step: `docs/track-routing.md`.

## D9 — The route is the track

The planned route is the stage's track: Continue hands `{ points, track }`, the track being the routed
legs with `goal` = the goal's point index. The form takes it as a drawn GPX (same as a drawing), so the
form's start / goal / end and the line never disagree. "Draw track" opens the drawer seeded with the
route's stops (or its track), the goal kept as the same point through every edit; finishing hands the
track back and the form's points follow its stops — a stop moved less than 200 m keeps its name and
height, farther it is looked up again. Reopening the planner on a stage with a drawing routes from that
drawing (its legs kept unless their points move). Going straight drops a drawn track; an uploaded GPX is
fixed: the planner shows it as is and moving points never touches it. While a drawing is the track
the form offers no start / end suggestions (they would leave the track behind): "Choose" goes through the
route step, which moves the track with the point. A drawing begun at the goal says so for the start
("at the goal, where the track begins").

## D10 — Days inside the route step

With more than one day the planner's title becomes day pills; "Next day" commits the current day and
plans the next from its end (else goal) without closing — no flicker, no form between days. A pill
switches days the same way. Done closes on the first day of this planning run, framed on the outing.
The planner opens framed on its day (at least zoom 14). With a form behind it, its leading button is a
back arrow ("back to the details, without these changes"), never an X that might drop a day; with
none, its × asks before it drops points already set (keep editing / discard), like the form's ×. While
several days are drafted the day being planned is drawn full, the others dimmed, each goal labelled
"Day n goal".

## D11 — Shared fields follow the first day

Activities, partners and visibility are the outing's, set once: a change on a day is copied to each
later day that still had the old value (a day changed on its own keeps its own). Dates chain: a later
day that is empty or was n days after this one moves with it. The next day's start follows this day's
handover (its end, else its goal) while it still sat on the old one — and a drawn track's first leg is
routed again from there; a start set elsewhere stays. The goal is named by its place (the planner's
name or lookup), apart from a tour name typed in the form.

## D12 — Stage tabs

The stage strip is a row of tabs (day, date, name) in the app's selectable-chip look: outlined, the
day on screen tinted with a primary outline, all one size; three days and a round tonal "+" (44 px)
fit side by side at 360 px. More days scroll under the "+", which stays pinned at the row's end with
the days fading out beneath it, and the day on screen scrolls into sight (also when the form comes
back from the route step). A name stands on one line and ends in "…" (the tab's title, and the form
below, hold it whole). The route step's day pills wear the same chip look. Removing a later day moves to the bottom of its form, away from the tabs.

## D13 — The route step shapes its line

Following the ways, each routed leg in the route step gets the drawer's handle halfway along (none on a leg
under 40 px on screen, none while a point is held); dragging it pulls out a point between the stops,
dragged on like any point. Let go, a point between lands where the leg before it reaches along the ways
(`useLegRouter.resolve` from the stop before, as the drawer's `dropInsert`) — a stop is a place and stays
exactly where it was set, a point between only says which way — and that leg is the one it came by; the
leg on is routed from there. A point between joins a way only right where it lies (`VIA_SNAP_M`, 10 m):
off the ways it was let go there on purpose, and both its legs go straight to it, as to a tap off the
ways in the drawer, rather than reaching 250 m like a stop and drawing a spur out and back. Rundtour
goes back the way up by default: the points between of the way up again in reverse, each leg the
reverse of the one going up (`legOf` falls back on the reverse leg, so nothing is routed again); its
handles then shape a different way back. The form's Rundtour gives a drawn route ending at its goal the
same way back (`withWayBack`, the drawer's "Zum Start"). A tap on a point between removes it. They are the route's `vias` (up before
the goal, down after it), so the track handed on carries them as drawing points: "Edit on map" and a
reopened route step show them, the drawer's handles and undo working on as before. The points between and
the handles are drawn by the drawer's layer (`useTrackDrawLayer`, points only); the page draws the line
and the stops. While a leg is on its way the follow row turns its icon and says "finding the way…", and
the numbers stand fainter until the new ones come; the next-step line explains the handles ("drag a line's
middle dot…", then "tap a point you pulled out to remove it").

## D14 — The route step's sheet folds

On a phone the panel gets a grip: dragging it (or the head, not its buttons; sideways scrolls the days)
folds the points' rows, the route hint and the follow row away, gliding with the finger, a flick going
all the way; a tap on the grip toggles it. Folded, the panel keeps the day pills or title, the numbers with
the next step, and the buttons, about half its height; the summary line then says a leg is on its way or
found no way, as the folded follow row would. The page holds the fold across the trip's days (like the
follow switch) and drops it with the creation. Desktop docks the panel beside the map and has no grip.

