## Why

The tour form offers the end point only once a start point is set. A tour that needs a goal and
an end but no start — a paragliding flight from the launch at Lauchernalp (the goal) to the
landing in Wiler, a bike ride down from a summit — has to set a start, pick the end, then delete
the start again. Since `end-point-without-start` an end stands on its own everywhere else (model,
map, info sheet, route numbers); only the form still makes the end wait for the start.

## What Changes

- The tour form SHALL offer the end point section always, with or without a start, in create,
  edit and suggest alike. Start and end can be set, changed and removed in any order.
- "Round Trip" SHALL be offered only while a start is set (it copies the start); without one,
  the empty end section offers "Add end point" (or "Add landing") and its suggestions.
- Removing the end, or the only point, SHALL bring back the empty end section instead of hiding
  it.
- A picked GPX SHALL fill no point at the goal: a track from the goal leaves the start empty, a
  track up to it the end.
- A landing card SHALL suggest only an earlier tour's landing, never where an earlier hike to the
  same goal ended.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tour-form-extended`: the end point section no longer waits for a start; "Round Trip" needs
  a start; a GPX fills no point at the goal; a landing is suggested only from earlier landings.
- `tour-extended-model`: an end without a start is also what a tour that only needs its end
  (a flight from the goal) saves, not only a connected stage.

## Impact

- `src/features/tours/presentation/components/tour-form.vue` (end section gate, Round Trip gate,
  GPX fill)
- `src/features/tours/presentation/components/point-suggestions.vue` (landing history)
- `test/features/tours/presentation/components/tour-form.test.ts`,
  `point-suggestions.test.ts`
- No data, map or API change: every layer below the form already accepts an end without a
  start.
