## Why

The tour form treats goal, start, and end points as flat fields with thin labels, so users cannot quickly tell which name/elevation belongs to which point. The end point row is also reachable before a start point is set — but an end point without a start is meaningless, since the tour shape (one-way vs round trip vs free) is defined relative to the start. Users requested a one-tap "Round Trip" affordance instead of having to re-pick the same coordinates.

## What Changes

- Gate the end point section behind a non-null start point: end point UI SHALL be hidden entirely when no start point is set.
- When the user removes the start point, the end point and its metadata SHALL be cleared in the same action (an end point without a start is invalid).
- Add a "Round Trip Tour" button next to "Add end point" (only visible while start is set, end is null) that copies the start point's coords, name, and elevation into the end point fields.
- Visually separate the goal, start, and end blocks into distinct cards with a colored accent border and an icon-prefixed header, so name/elevation inputs are unambiguously scoped to one point.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tour-form-extended`: Tighten the "Start and end point pickers" requirement (end point gated on start, removing start cascades), add a "Round Trip Tour" affordance, and add a visual-grouping requirement for the three point sections.

## Impact

- `src/features/tours/presentation/components/tour-form.vue` — end point block guarded by `v-if="startPoint"`; new `handleRemoveStart` cascades to end fields; new `handleRoundTrip` copies start→end; goal/start/end wrapped in `.point-section` cards with colored left border + icon header.
- `src/locales/en.json`, `src/locales/de-CH.json` — new key `tours.form.roundTripBtn`.
- No DB / API / store changes.
