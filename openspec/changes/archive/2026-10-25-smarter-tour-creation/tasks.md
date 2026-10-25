# Tasks

## 1. Database

- [x] 1.1 Migration `tour_grade_start_time`: `tours.grade` (≤ 20) and `tours.start_time`; recreate
      `tours_view` / `friend_tours_view` (start time partner-gated); `create_tour_full` /
      `update_tour_full` with trailing `p_grade` / `p_start_time` (null keep, '' clear); re-grant
- [x] 1.2 Suggestions: `grade` field (CHECK, `tour_field_value`, `fn_apply_tour_suggestion`),
      `dates` carries `startTime` when set; `fn_emit_suggestion_tour_update` and
      `fn_is_meaningful_tour_change` include grade and start time
- [x] 1.3 Apply locally; pgTAP suite for create/update keep/clear, suggestions and staleness

## 2. Data and domain

- [x] 2.1 Schemas, `Tour` / `TourDraft`, repository RPC params, `tourToDraft`, demo data
- [x] 2.2 `seasonsForDates`, grade scales, `trackEnds`, `nextSegmentSeed` next day
- [x] 2.3 Search: role-aware ranking by `objectclass`, stops via featuresearch, dedupe
- [x] 2.4 Stops near a point (identify) service

## 3. Form

- [x] 3.1 Reorder sections (where → what → when → who → details)
- [x] 3.2 Grade field with scale chips; start time beside the date
- [x] 3.3 Start / end suggestion chips (history + stops)
- [x] 3.4 Derived seasons; GPX fills empty points; multi-day hint
- [x] 3.5 Picker passes its role to the search; stops show their kind

## 4. Stages, details, routes

- [x] 4.1 Gap row "Connect" for the owner
- [x] 4.2 Add-stage view states the rule
- [x] 4.3 Grade and start time in detail facts, list rows, stage cards; suggestion diff and rows
- [x] 4.4 "Plan as tour" on the ski-route card

## 5. Verify

- [x] 5.1 Unit and component tests (edge cases), `npx eslint . --fix`, type-check, `npm run test`,
      locale parity, `openspec validate --strict`
- [x] 5.2 Headless walk on phone and desktop; onboarding tour still in sync
- [x] 5.3 Independent review; follow-up issues filed
