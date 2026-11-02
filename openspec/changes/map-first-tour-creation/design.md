# Design

## D1 — One route planner for every creation pick

A new map overlay, `route-planner.vue`, owns the three points of the stage being planned. A tap on the
map sets the active point and moves on (start → goal → end); a search result sets it with its name; a
point can be dragged (mouse, pen or finger — the same gesture code as the track drawer). Each set point
looks up its name (unless the search named it) and height at once; the panel shows the three steps
with name and height, the climb and descent of the legs it knows (`pointMetrics`), and the actions:
Skip (start), Round trip (end, with a start), Remove (a set start or end), Continue / Done.

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
