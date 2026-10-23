# Proposal

## Why

A hike & fly is one tour: walk from the start to the summit, fly from the summit to the landing.
Today a tour holds one set of activities for the whole route, so a pilot either ticks hiking and
paragliding (and the app can't tell which way each one goes — the map bands the whole track red
and amber, the detail reads "Wandern, Gleitschirm") or splits the day into stages, which the
stage rule itself says is wrong ("one day, one tour"). The same goes for climb & fly, ski & fly,
bike & fly and the hike & bike where the bike is carried up and ridden down.

## What Changes

- **Activities per leg.** A tour's route already has two legs: start → goal and goal → end. A
  tour with two or more activities says, per activity, whether it is used on the way up, the
  way down or both. Default: both (as today), except paragliding with other activities — it
  goes down, the others go up, so a hike & fly is two taps.
- **Detail, stage cards:** a split tour reads "↑ Hiking ↓ Paragliding". When the way down is
  flown, the end point is the landing.
- **Map:** without a track the start → goal and goal → end lines wear their own leg's colours;
  a GPX track changes from the way-up colours to the way-down colours at the point nearest the
  goal.
- **Suggestions** of activities carry the legs; the next stage of an outing inherits them.
- **Stage rule** names hike & fly as one tour.

## Impact

- **DB:** new migration — `tours.ascent_types`, `tours.descent_types` (both null = not split;
  `tour_types` stays the union, so every reader of `tour_types` — filters, colours, the Worker,
  older apps — keeps working). `create_tour_full` / `update_tour_full` gain trailing
  `p_ascent_types` / `p_descent_types` (null = keep while the activities still match, `{}` =
  clear). `tour_type` suggestions of a split tour carry the legs.
- **Frontend:** schema, entity, repository, store, form (new leg picker), fact rows, stage
  card, activity disc order, map connectors and track gradient, suggestion diff and rows,
  locales.
- **Deploy order:** migration before the frontend.
- Builds on `smarter-tour-creation` (same branch).
