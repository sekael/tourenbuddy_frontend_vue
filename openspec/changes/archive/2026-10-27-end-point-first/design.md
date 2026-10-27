## Context

`tour-form.vue` gates the end point section on `startPoint || endPoint`. The gate dates from when
an end without a start was an invalid state; `end-point-without-start` made that state valid in
the model, on the map, in the info sheet and in the route numbers, and kept the gate only for
creation. The same form serves create, edit and a friend's suggestion, so the gate is the single
place to change.

## Goals / Non-Goals

**Goals:**

- Set the end point without a start, in any order, in every mode of the form.

**Non-Goals:**

- A "reverse round trip" that copies the end into an empty start: picking the start is one tap
  or one suggestion chip away, and a start at the end is not the common case this fixes.
- Any change below the form: the draft, the store, the RPCs and the map already carry an end
  without a start.

## Decisions

### D1 — The end section is always rendered

The empty start and the empty end sit side by side in a new form, each with its picker and its
suggestions. Alternatives: an "Add end point" toggle that reveals the section (one more tap for
the flight case, the very round trip this removes), or ordering the sections by activity (the
form would reshuffle as activities change). Always rendering is the smallest and most
predictable change.

### D2 — "Round Trip" needs a start

It copies the start into the end; without a start it has nothing to copy, so it is not
rendered. The handler keeps its guard.

### D3 — A GPX names no point at the goal

The track's first and last points fill the empty start and end (smarter-tour-creation D6). A
flight from the goal, or a descent by bike, starts at the goal, so the form would fill a start
that stands on the goal and that the user deletes again, the very round trip this change removes.
A track end within 200 m of the goal (the loop tolerance) now fills nothing; a walk up that ends
at the goal leaves the end empty the same way. A point at the goal is the goal: a tour without an
end ends at its goal (tour-extended-model), so a flight that lands back at its launch saves no
end; a missing start has nothing to show, which a start on the goal would not change. The old
start = end = goal round trip from such a track is gone: two markers on the goal and a "Round
trip" label in the info sheet. A loop needs a start to return to.

200 m and not the 500 m that keeps a stop from being offered as a start: a stop that close to
the goal is its cable car or bus — no way up — while a track end is the goal itself, off by the
recorder's start-up and the goal marker's placement.

### D4 — A landing is suggested only from earlier landings

The empty end card offers the user's latest own end for the goal. For a flown way down it now
takes only tours that landed (`landsByAir`), as the card's own comment always said, so the first
chip for a flight from the goal is never where an earlier hike ended.

## Risks / Trade-offs

- A new form now shows both suggestion rows, so the nearby stops are looked up twice for the
  same goal, one identical request per card, and a stop may show in both cards → accepted: a stop
  can be either end, each card's chip sets its own point, and the cost is one small extra
  request. Sharing the lookup would move it into the form, gated on which cards are empty, or
  add a reference-counted cache with its own abort handling to the stop service — more code than
  the request it saves.
- A track end recorded up to 200 m from the goal counts as the goal: a hut that close to its
  summit is not filled as the start; the user picks it. Until then, a track without heights
  shows no start → goal climb (the point heights lack the start); a track with heights counts
  its own.
- An outing segment without a start — never seeded (an existing tour added to the outing) or
  its seeded start deleted — shows no "Starts away from …" hint and no transfer line, even when
  its goal lies away from where the previous segment finishes: `outingGaps` compares only a start
  that exists. A GPX that starts at the goal now leaves such a segment without a start, where it
  used to fill one on the goal.
- A segment added from the outing ("Add segment") is seeded with the previous finish (its end,
  else its goal) as its start (`nextSegmentSeed`). A GPX that starts at the new goal does not
  replace it — the seed is a set point the form shows — so the stage keeps the previous finish as
  its start — where the day's way to the launch begins — shown as the start row, the open
  segment's start marker and, in the outing overview, a handover ring. No line is drawn from it
  to the launch: a tour with a GPX draws its track, never connectors. A user who wants a flight
  from the goal alone deletes the seeded start, and with it the row and the start marker; in the
  overview, the ring gives way to the previous segment's end marker, where that segment ends.
  Treating the seed as a guess a GPX may overwrite would need a "seeded, untouched" state in the
  form and an exception to "set points never change", for a case the user sees and can change in
  one tap.
