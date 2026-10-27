## Why

Marking a tour with a GPX track completed or incomplete, or toggling its visibility, blanked the
track on the map for a moment. The parsed-track cache was keyed by the tour's `updatedAt`, which
the database bumps on every row write, so a row-only write missed the cache and the map emptied
the track while it re-downloaded and re-parsed the same file. The route numbers fell back to
point heights for the same moment.

Already fixed in code (`fix(map): keep GPX track visible when toggling completed or
visibility`); this change brings the specs in line. The specs still describe GPX objects as
living at the canonical key `<uid>/<tourId>.gpx` and being overwritten on replace — which the
form had already stopped doing, and which accepting a GPX suggestion still did, colliding with
(and then deleting) a tour's own track.

## What Changes

- GPX storage keys are written once: a new tour's file lives at `<uid>/<tourId>.gpx`, every
  later pick and every accepted GPX suggestion at `<uid>/<random uuid>.gpx`. A replace changes
  `gpx_filepath`; no object is ever overwritten.
- The parsed track is cached by storage path. A row-only write keeps the track drawn and the
  route numbers unchanged; a replaced track loads from its new path.
- Accepting a GPX suggestion copies the staged file to a fresh key in the owner's prefix, never
  the tour's current path. A failed accept removes its copies only when the server rejected the
  call; a lost response keeps them, since the accept may have committed.

## Capabilities

### Modified Capabilities

- `gpx-tracks`: write-once storage keys; cache keyed by storage path, track kept across row-only
  writes.
- `tour-extended-model`: `gpxFilepath` no longer always `<owner uid>/<tour id>.gpx`.
- `tour-attachments`: accepted GPX copy goes to a fresh key; failed-accept copy cleanup.
- `tour-info-extended`: route numbers hold across row-only writes.

## Impact

Specs only — the code shipped in commit `76f0885d`. No DB or API change.
