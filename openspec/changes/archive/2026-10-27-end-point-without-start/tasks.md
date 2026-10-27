# Tasks

## 1. Map

- [x] 1.1 `connectorLegs`: draw goal → end for a tour with an end but no start (no round trip
      without a start); a goal-only tour still draws nothing
- [x] 1.2 `tourDetailMarkers`: show the end marker (saved and draft) without a start; round-trip
      dedup only against a start that exists

## 2. Tour details and form

- [x] 2.1 `tour-fact-rows`: route group and end row render for an end without a start; a round
      trip is the same place within 10 m, as on the map
- [x] 2.2 `tour-form`: removing the start keeps the end and its metadata
- [x] 2.3 `pointMetrics`: every rise is climb and every drop descent over the legs that exist
      (a leg the tour does not have, or one missing a height, adds nothing)
- [x] 2.4 Spec sync with the shipped behaviour: info sheet point rows,
      Landing labels, tour framing, outing header/cards, end suggestions, button labels
- [x] 2.5 A GPX track with heights counts every rise and drop, a split tour's too; a way flown
      whole (a lone glider's unsplit way down included) counts its net change, the distance the
      walked way's (`flownTrackMetrics`)
- [x] 2.6 `totalMetrics`: outing totals add up what the segments know

## 3. Verification

- [x] 3.1 Tests: connector (unsplit and split) without a start, detail markers (saved and
      draft end) without a start, the C–A–B outing hand-over, end row alone, the form editing a
      stage without a start, start removal keeps the end, route numbers per leg, split and flown tracks, outing totals
- [x] 3.2 `npx eslint . --fix`, `npm run type-check`, `npm run test`
- [x] 3.3 Independent review until no findings remain
- [x] 3.4 Real app (headless walk, local stack): an outing C–A–B whose first stage C has a goal and
      an end but no start shows C's goal → end leg with arrows in the overview and when opened,
      its end marker, and the end row in its details

## Workflow follow-up

- Archive with `openspec-archive` once merged.
