# Tasks

## 1. Database

- [x] 1.1 Migration `tour_activity_legs`: columns + CHECK, views, RPCs with trailing leg args (D2), meaningful change
- [x] 1.2 Suggestions: `tour_field_value` / `fn_apply_tour_suggestion` legs (D6)
- [x] 1.3 Apply locally; pgTAP suite

## 2. Client

- [x] 2.1 Schema, entity, draft, repository, store, outing seed
- [x] 2.2 Domain `legs.ts`: defaults, legs from directions, display order
- [x] 2.3 Form leg picker; end point named landing when flown
- [x] 2.4 Fact rows, stage card, activity disc order
- [x] 2.5 Map connectors per leg; track gradient split at the goal
- [x] 2.6 Suggestion diff and rows; stage rule copy; locales
- [x] 2.7 Split tracks measured per leg (a thermal is no climb); flown descent labelled; start
      suggestions skip stops at the goal; a landing suggests only earlier landings
- [x] 2.8 Review round 3: picker never empties a way and keeps removed choices; hike & bike
      defaults; partly flown ways keep the glider; route numbers in the detail hero; no "↓ 0 m";
      flown GPX distance = way up; MTB violet; list disc up-first; start/landing distance from goal
- [x] 2.9 Review rounds 4–5: flown ways keep the arrow and show their activities; greyed ways say
      why; a lone glider can fly from the start; outing totals mark flown ways; a search pick
      confirmed mid-flight keeps the result and its name

## 3. Verify

- [x] 3.1 Tests, eslint, type-check, locale parity, openspec validate
- [x] 3.2 Walk phone + desktop; independent pilot review until no findings remain
