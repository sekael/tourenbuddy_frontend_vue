# Design

Source: eleven independent reviews of tour creation, one per activity type, each from a
passionate athlete and a professional of that activity (ski instructor, freeride coach, IFMGA
guides, splitboard guide, flight instructor, hiking leader, climbing instructor, MTB guide,
running coach), plus a walk of both flows in the real app on phone and desktop. Claims about
scales and data were checked against primary sources (SAC scales, geo.admin APIs).

## D1 — The search knows what is being picked

The picker passes its role (`goal` | `start` | `end`) to the search.

- **start / end:** a second request searches public-transport stops
  (`SearchServer?type=featuresearch&features=ch.bav.haltestellen-oev`, max 5), merged with the
  location results (a stop within 150 m of a same-named place is dropped). Results are ordered
  by **access class** before anything else: 0 = stops, stations and cable cars
  (`TLM_HALTESTELLE`); 1 = villages (`TLM_SIEDLUNGSNAME`), buildings incl. huts and hotels
  (`TLM_GEBAEUDE`), municipalities, postcodes; 2 = everything else, including summits and passes
  (`TLM_NAME_PKT` holds both, and passes are common starts); 3 = house addresses
  ("Steingletscher 365c", rarely meant); 4 = terrain (`TLM_GELAENDENAME`: glaciers, ridges). The class is read from `attrs.objectclass`, which is
  language-independent (the label's kind is translated).
- Inside a group of same-named places the existing nearest-first rule (zoom ≥ 9) now sorts by
  (class, distance). That is what put the glacier first in the walk: it was nearer the
  Sustenhorn crosshair than the hamlet Steingletscher.
- **goal:** unchanged (service order, nearest-first among duplicates).

Why not filter instead of rank: a start can be anything (a glacier camp, a summit for a flight);
ranking never hides a result.

## D2 — Start and end suggestions

Once the goal is known and the start (or end) is empty, the card shows up to three chips:

1. **Your earlier start for this goal** — the most recently updated own tour whose goal lies
   within 300 m and that has a start point (deduplicated by name).
2. **Nearest public-transport stops** — `MapServer/identify` on `ch.bav.haltestellen-oev`
   around the goal (within 8 km: the trailheads of big summits lie 6–8 km off), sorted by
   distance client-side, one per name.

A chip goes through the same path as a map pick (`pick` → name given, height looked up), so
typing still wins. The end card offers the same stops minus the chosen start, next to
"Rundtour". Offline or on a failed lookup only history chips show; nothing errors.

Own tours only: friends' starts are visible to the user, but surfacing them in someone else's
form is a sharing decision for later.

## D3 — Grade

`tours.grade text` (≤ 20 characters, trimmed, empty = null). Free text, because activities mix
(T4 approach to a 5c route) and scales have modifiers (ZS−, WS+). The form offers the selected
activities' closed scales as chips; a tap sets the value:

| Activity | Scale (source) |
|---|---|
| Wandern, Trailrunning | T1–T6 (SAC Wanderskala) |
| Skitour, Splitboarden, Skihochtour, Hochtour | L, WS, ZS, S, SS, AS, EX (SAC Ski-/Hochtourenskala) |
| Mountainbiken | S0–S5 (Singletrail-Skala) |
| Klettern | no chips — hint "z. B. 5c oder V+" (French and UIAA both in use) |
| Skifahren, Snowboarden, Gleitschirm | no scale — free text (e.g. a pilot's required level) |

Never computed (reviewers: a computed grade is false precision). Shown wherever the activity
is: detail facts, list rows, stage cards. Suggestable (`grade` field); a change notifies
partners like a description change.

## D4 — Start time

`tours.start_time time`, optional, only with a planned date (cleared with it). Shown after the
date ("Sa., 13. März · 06:30"). Partner-gated in `friend_tours_view` like the date. It rides the
`dates` suggestion (`startTime` key, written only when set so pending suggestions' base values
stay equal). The calendar feed keeps all-day events for now (follow-up).

## D5 — Stale clients and queued drafts keep grade and time

`update_tour_full` is a full-row overwrite. A cached old build or a queued pre-change draft
doesn't know the new fields; overwriting with null would wipe them. So the new trailing
arguments follow the outing pattern (D12 of multi-activity-tours): `null` = keep (update) /
none (create); `''` = clear; anything else = set. New clients always send the value or `''`.

## D6 — Derive, don't ask

- **Seasons follow the dates** (meteorological: Dec–Feb winter, Mar–May spring, Jun–Aug summer,
  Sep–Nov autumn; a span gets every season it touches) while the chips are "automatic": true
  when the form opens with no seasons or with exactly the dates' seasons, false once the user
  taps a chip. Undated tours keep manual chips (wish-list tours).
- **A picked GPX fills empty points:** start = first track point, end = last track point, or a
  round trip when they lie within 200 m. Never overwrites a set point; the goal is untouched.

## D7 — Plan a tour from a ski route

The ski-route card's route gets a "Plan as tour" button. The goal is the route's target summit,
found by the place search (the target's name without a massif suffix — "Furggegütsch (Hohgant)" →
"Furggegütsch" — the same-named place nearest the route, within 1.5 km). The route's ends can't be
trusted for it: a sample of 30 routes ran foot → summit 27 times, and multi-part routes end on a
variant. The start is the route end farthest from the goal, named and measured by the form's own
lookup. Seed: name = target name, goal height = target altitude, activity `skitour`, grade = the
route's difficulty in the UI language, description = route name + SAC link. Offline or without a
match the route's last point is the goal.

## D8 — Stages follow the nights

All eleven reviewers define a stage the same way: one day with one party is one tour, however
many summits, pitches or laps; a night starts a new stage.

- `nextSegmentSeed` dates the new stage the **day after** the previous stage's last day.
- A gap row offers **Connect** to the owner: the previous stage's end point becomes the next
  stage's start (name, height) — "we sleep where tomorrow starts". Gaps stay shown otherwise.
- The rule is said where the question arises: in the add-stage view, and below the end date
  when a span covers more than one day.

## D9 — Form order

Where → what → when → who → details: name, goal, start, end · activities, grade · date, start
time, end date, seasons · partners, visibility · description, equipment, notes · GPX ·
attachments. The date moves up from the details block, the seasons follow it (they now derive
from it). New pieces live in their own components (`point-suggestions.vue`,
`grade-field.vue`) — the form is already ~1600 lines.

## Rejected (with the reviewers' reasons)

- Live weather, avalanche or airspace data in the form — stale by the time of the tour.
- Computed duration / effort / glide estimates — group- and condition-dependent.
- Per-pitch or per-run sub-stages; auto-splitting a GPX into stages.
- Warnings about mixing activities (ski + split groups are normal).
- Preselecting a default activity — a wrong marker colour nobody notices.
