## ADDED Requirements

### Requirement: A planned ski route carries its line

"Plan as tour" SHALL also take the route's own line as the new tour's track: from the plan's start
along the route's parts up to the route point nearest the goal and, when the route states a
descent, down to the plan's end — saved as GPX with terrain heights so the tour's climb, descent
and distance come from it and match the route's. Parts that do not connect SHALL fall back to the
route's longest part, run from the end nearer the start. The track SHALL stay editable on the map.

#### Scenario: Planning a ski route

- **WHEN** the user plans the route "Sustenhorn" (1640 m up and down) as a tour and saves it
- **THEN** the tour SHALL show the route's line as its track, and climb and descent close to the route's stated 1640 m each

#### Scenario: A variant branches off

- **WHEN** a route has a variant part branching to another top
- **THEN** the track SHALL run to the goal and leave the variant out

### Requirement: A planned route starts and ends where its figures say

A planned route's start and end SHALL be loose ends of the route (where no other part meets it):
the start the one whose terrain height lies the route's climb below its summit, the end the one its
descent below — another end for a traverse, the start again (back the same way) for most routes.
Without those heights or figures, the start SHALL be the loose end farthest from the goal and the
way down the way up.

#### Scenario: A traverse

- **WHEN** the user plans "Eggerhorn, von Binn über Äbnimatt mit Abfahrt nach Ausserbinn" (1100 m up, 1200 m down) as a tour
- **THEN** the track SHALL start at Binn, run up to the summit and down to Ausserbinn, and the form SHALL take Binn as start and Ausserbinn as end

#### Scenario: Offline

- **WHEN** the terrain heights can't be had
- **THEN** the start SHALL be the loose end farthest from the summit and the track SHALL return to it

### Requirement: Plan a ski route from the goal pick

While picking a new tour's goal (not a segment's, not an edit's) with ski routes shown and online, a
tap on a marked ski route SHALL open its card as on the map, and the picker SHALL say so in a line
above its search. "Plan as tour" SHALL plan it with its line as track; closing the card SHALL return
to the goal pick.

#### Scenario: Tap a route while picking the goal

- **WHEN** the user taps "+", sees ski routes, and taps a marked route instead of confirming the crosshair
- **THEN** the route's card SHALL open, and "Plan as tour" SHALL open the form with goal, start and track from the route

#### Scenario: Back to picking

- **WHEN** the user closes that card
- **THEN** the goal pick SHALL be active again


## MODIFIED Requirements

### Requirement: Ski route details

The card SHALL show, where present: route name, target and its altitude, difficulty, ascent time,
ascent and descent in metres, and a link to the route in the SAC tour portal, laid out like a
tour's details: the ski-tour disc, the altitude as headline, the difficulty as grade badge with the
ascent time — labelled as the ascent's and taken at the user's pace, the pace's factor badge beside
it when off 1.0, an unusual wording as SAC gives it — and climb/descent beside it, "Plan as tour" and the SAC
link as full buttons. Text and
link SHALL use the UI language when Swisstopo provides it, else the original. Missing fields SHALL
be omitted.

#### Scenario: Route with full information

- **WHEN** the selected ski route has a name, target, difficulty, ascent time, ascent/descent and an SAC link
- **THEN** the card SHALL show all of them, and the SAC link SHALL open in a new tab

#### Scenario: Ascent time at the user's pace

- **WHEN** SAC states an ascent time of "05:00 h" and the user's pace is 1.2
- **THEN** the card SHALL show "Ascent 4:10 h" with the badge "1.2×" beside it

#### Scenario: Name missing in UI language

- **WHEN** the UI language is English and the route has only a German name
- **THEN** the card SHALL show the German name

#### Scenario: Narrow phone

- **WHEN** the card shows a route with every field on a 360 px wide phone in German
- **THEN** the facts SHALL wrap between items, never inside one, and both buttons SHALL show their
  full label
