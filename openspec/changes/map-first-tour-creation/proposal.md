# Proposal

## Why

Follow-ups #348 and #349 of `smarter-tour-creation`, where all eleven activity reviewers asked for them.

- **#348 Map-first creation.** Creating a tour hops between a full-screen map picker and a form that
  hides the map: goal, start and end are each a separate picker round trip. On desktop the form is a
  small centred dialog over a blurred map, so the route is never visible while planning.
- **#349 Multi-day in one flow.** A multi-day trip is built one stage at a time: save the first tour,
  open it, "Add segment", pick, save — per day. A multi-day date span only gets a hint to do that.

## What Changes

- **Route step on the map.** "+" opens the route planner on the live map: start → goal → end are set in
  order by a tap on the map or a search, each point can be dragged, a step can be skipped (start, end)
  or the end set back to the start (round trip). The straight legs and the climb and descent from the
  points' heights show as the points land. "Continue" opens the details form with the points, their
  names and heights already filled — no lookup runs twice.
- **The planner is the creation's one way to set points.** The form's Pick / Change / Add end point
  buttons reopen the planner on that point (all points shown, any can be moved); Done hands the moved
  points to the form. The crosshair picker stays for editing saved tours.
- **Desktop: the form in the side panel.** The creation form opens in the right side drawer like the
  tour details, never collapsing while the planner runs; the map beside it shows the draft route.
- **+ Next day.** After the end point the creation form offers "+ Next day": a new stage starting at this
  stage's finish (end, else goal) the day after its last day, with its activities, partners, visibility
  and seasons; the planner opens for its goal. A strip over the form switches between the stages; one
  Save creates them all as one outing in order.
- **Split into daily stages.** A creation form whose dates span several days, and a saved standalone
  tour that does, offer "Split into daily stages": the tour keeps its first day and the next day's stage
  opens in the planner, titled "Day n of m".
- **The map shows the draft outing** — every stage's goal, start/end and straight legs or drawn track.

## Out of scope

- Splitting a track into days, an outing name field in the form (the overview renames).
- Map-first editing of saved tours (the edit form keeps its crosshair picker).

## Impact

- **Frontend only**, no migration: `map-page.vue` (creation state, stages, planner), new
  `route-planner.vue` + `use-location-search.ts` (search shared with the picker), `tour-creation-dialog.vue`
  (stages, side drawer), `tour-form.vue` (Next day, split, picks with heights, exposed draft), map store
  `previewStages`, `tourenbuddy-map.vue` / marker layer (draft stages), `tour-info-sheet.vue` (split),
  `outing.ts` (stage seed), locales.
- Saving N stages writes N `create_tour_full` calls with outing membership (existing RPC); offline they
  queue like any create.
