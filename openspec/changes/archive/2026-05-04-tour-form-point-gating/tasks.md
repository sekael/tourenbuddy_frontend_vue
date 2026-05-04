## 1. Git Setup

- [x] 1.1 Continue on branch `feat/61-gpx-track-storage` (work already implemented in current session). No new branch needed.

## 2. Tour form: gate end point on start point

- [x] 2.1 Wrap end point block in `v-if="startPoint"` so the entire end point section disappears when no start point is set.
- [x] 2.2 Add `handleRemoveStart()` helper that clears `startPoint`, `startPointName`, `startPointElevation` and ALSO clears `endPoint`, `endPointName`, `endPointElevation`.
- [x] 2.3 Wire start point's remove button to `handleRemoveStart` (was inline `startPoint = null`).

## 3. Tour form: round trip affordance

- [x] 3.1 Add `handleRoundTrip()` helper that copies `startPoint` coords, `startPointName`, and `startPointElevation` into the end point fields. Guard with `if (!startPoint.value) return`.
- [x] 3.2 Render "Round Trip Tour" button alongside "Add end point" in the empty end-state row (button only visible when end point section is rendered, i.e. start is set).

## 4. Tour form: visual separation of goal/start/end

- [x] 4.1 Wrap each of goal, start, end in a `.point-section` container with a colored left border and an icon-prefixed header.
- [x] 4.2 Use distinct accent colors per section (goal=primary, start=green, end=red) and matching Material Symbols icons (`flag`, `trip_origin`, `sports_score`).
- [x] 4.3 Move the goal-elevation field inside the goal `.point-section` card so it visibly belongs to the goal.

## 5. i18n

- [x] 5.1 Add `tours.form.roundTripBtn` to `en.json` ("Round Trip Tour") and `de-CH.json` ("Rundtour").

## 6. Verification

- [x] 6.1 `npx eslint . --fix && npm run type-check && npm run test` — all clean.
- [x] 6.2 Manual: open tour form with no start → confirm end section hidden. Pick start → end section appears. Click Round Trip → end fields populate with start values. Remove start → end fields clear.

## 7. Finalize

- [x] 7.1 Prompt user to commit with message: `feat(tours): gate end point on start, add round-trip button, group point sections`.
- [x] 7.2 Prompt user to push branch and open PR.
- [x] 7.3 After merge, prompt user to run `/opsx:archive tour-form-point-gating`.
