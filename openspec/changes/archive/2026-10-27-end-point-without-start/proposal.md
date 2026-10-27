## Why

"Connect" on an outing gap (tour-outings → Close a gap between stages) sets the previous stage's
end point to the next stage's start. When that stage had only a goal — e.g. a new first stage C
put before A–B — it is left with a goal and an end but no start. The specs and the code still
treat an end without a start as an impossible state, so the map draws no connector (no arrows),
the open tour shows no end marker and the info sheet shows no end row until a start is added by
hand.

## What Changes

- An end point SHALL stand on its own: every presentation of a tour's start and end handles a
  missing start independently of the end.
- Map connector: a tour without a GPX track and with an end but no start SHALL draw the single
  one-way leg goal → end (a split tour: its way down, in the way-down colours). A tour with only
  a goal still draws nothing.
- Map detail markers: the open tour's end marker SHALL show without a start (saved and draft).
- Info sheet: the end row SHALL show without a start row. A round trip SHALL be read as the map
  reads it — end within 10 m of the start — instead of identical coordinates, so an end picked a
  few metres off the start reads as a round trip on the map and in the sheet alike.
- Route numbers, from the most accurate data the tour has: GPX track with heights > point
  heights > nothing.
  - A GPX track with heights SHALL count every rise and drop, a split tour's too; a way flown
    whole (a lone glider's too) counts only its net change, the walked way every rise and drop,
    and the distance is the walked way's alone, with heights or without.
  - Point heights: every rise over the legs start → goal and goal → end SHALL count as climb and
    every drop as descent, whichever leg runs which way; a leg the tour does not have, or one
    missing a height, adds nothing and the other still counts. A connected stage now shows its
    numbers.
  - Outing totals SHALL add up what the segments know instead of withholding a total.
- Info sheet point rows: the spec now states what ships — the name in place of the coordinates,
  the elevation only beside a name.
- Tour form: removing the start point SHALL keep the end point and its metadata (the cascade
  existed only because an end without a start was invalid). Creation is unchanged: the end
  section is still offered once a start is set, and shows whenever an end is set.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `gpx-tracks`: the direction connector draws goal → end for a tour with an end but no start.
- `map-integration`: the end marker no longer requires a start point; the requirement now names
  the outing overview's own markers (loose ends and handover rings) as the exception to "only
  while viewing or editing a tour's details".
- `tour-info-extended`: the end row shows for a tour with an end but no start; route numbers take
  the most accurate data, count every rise and drop over the legs the tour has and leave out a
  leg without a height; a track with heights counts every rise and drop except on a way flown
  whole (its net), whose distance is the walked way's; point-row metadata matches the shipped
  behaviour.
- `tour-form-extended`: an end without a start is a valid form state; removing the start no
  longer clears the end; plus the spec sync below.
- `design-system`, `responsive-overlay`: spec sync below.
- `tour-outings`: totals add up what the segments know; plus the spec sync below.
- `tour-extended-model`: either point may be set without the other; a start without an end is
  one-way to the goal (corrects the old "round trip" wording, which no code follows); for an end
  without a start, the missing start gets nothing (no marker, no start → goal leg).

Spec sync (owner's request — requirements that no longer matched the code, found by a sweep of
the main specs):

- `design-system`: the detail's end label reads "Landing" for a flown way down.
- `responsive-overlay`: opening a tour frames the goal with whichever of start and end exist.
- `tour-outings`: the header's way needs both ends named; cards hide a 0 climb or descent; a
  start-less first stage still totals.
- `tour-form-extended`: the end section title reads "Landing" for a flown way down; real button
  label case; end suggestions also offer the user's earlier end, and none within 100 m of the
  start.

Restating the touched requirements also corrects their icon names to what ships since
`multi-activity-tours` (ring `trip_origin` for start, chequered flag `sports_score` for end): the
map-integration marker requirement said `home` / `flag`, the tour-info-extended both-points
scenario `flag`.

## Impact

- `src/features/map/presentation/components/gpx-track-layer.ts` — `connectorLegs`.
- `src/features/tours/domain/tour-detail-markers.ts` — `tourDetailMarkers`.
- `src/features/tours/presentation/components/tour-fact-rows.vue` — route group gating; round trip
  via `isSameGoal`.
- `src/features/tours/presentation/components/tour-form.vue` — `handleRemoveStart`.
- `src/features/tours/domain/route-metrics.ts` — `pointMetrics` per leg, `flownTrackMetrics`
  (was `legTrackMetrics`) with `wayMetrics`, `totalMetrics`; `legs.ts` loses the now unused
  `fliesDown`; `route-numbers.vue` comment; `outing-overview-sheet.vue` totals line gate.
- Tests for each. No DB, API, store, locale or Worker changes (the database never coupled the
  two points).
