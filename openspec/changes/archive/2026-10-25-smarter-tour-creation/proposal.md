# Proposal

## Why

An athlete-and-professional review of tour creation for all eleven activity types (walked in the
real app on phone and desktop, 2026-10-22) found the same problems in every activity:

- **Wrong start points.** The picker searches names alike for a goal and a start. "Steingletscher"
  lists the glacier (2905 m) before the trailhead (≈1865 m), and that height then drives the
  climb and descent numbers. Every reviewer flagged it (blocker for guides).
- **Typing what the app could know.** Season stays empty with a March date; a GPX fills nothing;
  a ski route on the map can't become a tour even though it knows its summit, grade and time.
- **Missing the two facts partners ask first:** how hard (grade — 8 of 11) and when we leave
  (start time — 8 of 11). Both end up buried in free text today.
- **When is it a stage?** All eleven agree: one day with one party is one tour; a night starts a
  new stage. The app never says so, seeds a new stage on the *same* day, and only warns about a
  gap between stages without offering to close it.
- **Form order** puts the date below seasons, partners and visibility.

Creating one tour on a phone takes 11 taps, 32 typed characters and 2 full-screen picker
round trips today.

## What Changes

- **The search knows what is being picked.** For a start or end point the picker also searches
  public-transport stops (including cable-car stations) and ranks stops, places and huts above
  summits and glaciers; for a goal it keeps the service order.
- **Start and end suggestions.** Once the goal is set, the start (and end) card offers one-tap
  chips: your own earlier start for this goal and the public-transport stops nearest the goal.
  A chip sets the point, its name and its looked-up height.
- **Grade.** An optional short grade per tour (≤ 20 characters) with the selected activities'
  own scales offered as chips: T1–T6 (hiking, trail running), L–EX (ski touring,
  splitboarding, ski mountaineering, mountaineering), S0–S5 (mountain biking); climbing gets a
  hint, others free text. Shown in the details, the list and the stage cards; suggestable by
  partners; a change notifies partners.
- **Start time.** An optional start time beside the planned date, shown with the date and
  carried in the `dates` suggestion.
- **Derive, don't ask.** Seasons follow the dates until the user changes them; a picked GPX
  fills an empty start and end point from its first and last track point (a loop ends at its
  start).
- **Plan from a ski route.** The ski-route card gets "Plan as tour": goal = the route's summit
  with its name and height, start = the route's foot, activity ski tour, grade = the route's
  difficulty, description = route name and SAC link.
- **Stages follow the nights.** A new stage is dated the day after the previous one; a gap
  between stages offers "Connect" (the previous stage ends where the next one starts); the
  add-stage view and a multi-day date span state the rule (a night starts a new stage).
- **Form order:** where (name, goal, start, end) → what (activities, grade) → when (date, time,
  end date, seasons) → who (partners, visibility) → details, GPX, attachments.

## Out of scope (follow-up issues)

- Map-first creation: place start, goal and end on the live map in one step (phone), and a side
  panel instead of a modal on desktop so the map stays visible (#348).
- Lay out a whole multi-day trip before the first save; split a multi-day span into daily stages (#349).
- Calendar feed and reminders using the start time (Worker change, #350).
- Filtering tours by grade (#351).
- Using the SAC route line as the tour's track (#352, relates to #323).

## Impact

- **DB:** new migration — `tours.grade text` (≤ 20), `tours.start_time time`; both views
  recreated; `create_tour_full` / `update_tour_full` gain trailing `p_grade` / `p_start_time`
  (null = keep on update, so stale clients and queued drafts never wipe them; '' = clear);
  suggestion field `grade`; `dates` suggestions carry `startTime`; grade and start time are
  meaningful changes.
- **Frontend:** search service + picker, tour form (split into smaller components), outing
  seed + timeline, trail card, details/list/stage cards, schemas, repository, suggestion diff and
  review rows, locales.
- **Deploy order:** migration before the frontend (stale frontends keep working).
- **Depends on** `multi-activity-tours` (outings, route numbers), which archives first.
