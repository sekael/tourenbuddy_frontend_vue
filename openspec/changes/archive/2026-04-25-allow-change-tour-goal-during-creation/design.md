## Context

The tour creation flow today is a two-step sequence orchestrated by `map-page.vue`:

1. User enters picking mode → picks a location → `handleLocationConfirmed` fires parallel Swisstopo lookups (`getElevation`, `suggestTourName`) and stores results in `pendingLocation`, `dialogInitialElevation`, `dialogInitialName`. The `tour-creation` overlay opens.
2. `TourCreationDialog` renders `TourForm` with `allow-goal-edit="false"` and the three initial values. From the form, the user can already pick `start`/`end` points via `handlePickPoint(type)` — the dialog stays mounted, `isPickingLocation` flips, the sheet collapses, and on cancel/confirm the dialog re-expands without losing form state.

The edit flow already supports `pickPoint: 'goal'` via `handleInfoSheetPickPoint`. The creation path does not — `tour-creation-dialog.vue:51` explicitly filters `'goal'` out and `TourForm` is passed `allow-goal-edit="false"`. Issue #69 asks us to close that gap.

## Goals / Non-Goals

**Goals:**

- "Change" button on the goal row in creation mode reopens the location picker.
- In-progress form state (name, date, partners, type, elevation, etc.) preserved across the picker round-trip.
- On confirm with a new location: goal coordinates, Swisstopo-suggested name, and Swisstopo elevation updated in the draft.
- On confirm with the same coordinates: no-op.
- On cancel: draft untouched.

**Non-Goals:**

- Changing the goal of an already-created tour (covered by existing edit flow in `tours` spec).
- Preserving a custom user-typed name across a goal change (issue specifies "automatic tour goal name" is updated — we overwrite the auto-suggestion).
- Offline caching of name/elevation lookups.

## Decisions

### 1. Reuse the existing secondary-pick plumbing

The creation flow already handles `pendingPickType = 'start' | 'end'` via `handlePickPoint` → `isPickingLocation = true` → sheet collapses → `handleLocationConfirmed` branches on `pendingPickType`. We extend this to `'goal'`:

- `pendingPickType` type widens to `'goal' | 'start' | 'end'` (it's already `'goal'` by default for edit mode).
- `TourCreationDialog` stops filtering `'goal'` from its `pickPoint` emit and forwards the `'goal'` case.
- `handleLocationConfirmed`'s creation branch adds a `'goal'` case that:
  - Compares new location to `pendingLocation.value`. If equal (both `lng` and `lat` match within `1e-7` epsilon, matching MapLibre coordinate precision), reopen overlay with no changes.
  - Otherwise, runs the same parallel `Promise.all([getElevation, suggestTourName])` and writes `pendingLocation`, `dialogInitialElevation`, `dialogInitialName` before reopening.
- `handleLocationCancelled`'s creation branch extends to include `'goal'` alongside `'start'`/`'end'` so the overlay reopens without changes.

**Alternatives considered:**

- A dedicated `handleGoalChange` handler on `map-page`. Rejected — duplicates the existing pick-point dance and splits the state machine.
- Moving the epsilon comparison into the `LocationPicker`. Rejected — the picker is location-agnostic; the semantic "same location as before" belongs to the caller.

### 2. Update `TourForm` initial values reactively

`TourForm` seeds internal refs from `initialName` / `initialElevation` on mount. Today those props are effectively static per dialog open. For goal change mid-flow, we need the form to observe prop changes.

Approach: add `watch` on `initialName` and `initialElevation` inside `TourForm` that overwrites the internal `name` / `elevation` refs when the prop changes to a non-null value. This intentionally clobbers any user edits to name — consistent with the issue spec ("automatic tour goal name").

**Alternatives considered:**

- Keyed remount of `TourForm` with new defaults. Rejected — would also clobber all other in-progress form values, defeating the point.
- Exposing an imperative `applyGoalUpdate(name, elevation)` method via `defineExpose`. Rejected — more wiring for no extra benefit; reactive props are the Vue-idiomatic path.

### 3. Coordinate-equality threshold (~10m)

Convert both old and new goals to LV95 meters via the existing `wgs84ToLv95(lng, lat)` util in `src/core/utils/wgs84-to-lv95.ts`, compute euclidean distance `sqrt(dE² + dN²)`, and treat the points as equal when distance ≤ `10` meters.

Rationale: 10m matches the "same spot" intuition on Swiss topo at typical map zoom — the crosshair is well under 10m of positional ambiguity between quick re-picks, but a deliberate re-pin to a neighboring feature (peak vs. adjacent saddle) is reliably >10m. LV95 is meters-native, so the threshold is trivially interpretable and unaffected by latitude.

**Alternatives considered:**

- Degree epsilon (e.g., `1e-4`). Rejected — longitude degree varies with latitude; meters are unambiguous.
- Haversine on WGS84. Rejected — extra math for no gain when LV95 conversion is already a project util.

## Risks / Trade-offs

- **User-typed name clobbered on goal change** → documented behavior per issue; acceptable. Mitigation: only overwrite name when the new suggestion is non-null; leave user text alone if Swisstopo returns nothing.
- **Swisstopo latency stalls reopen** → same exposure as the original pick. Existing UX (brief spinner / delay before dialog reopens) carries over. Consider showing loading state in the collapsed sheet header if latency surfaces as a complaint (out of scope for this change).
- **Picker cancel after already editing form** → form state lives in `TourForm`'s internal refs; the overlay stays mounted (`v-if="showTourCreationDialog"` stays true throughout), so no state is lost. Verified by the equivalent start/end flow that already works.
