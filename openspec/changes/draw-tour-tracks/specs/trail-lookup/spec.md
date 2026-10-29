## ADDED Requirements

### Requirement: A planned ski route carries its line

"Plan as tour" SHALL also take the route's own line as the new tour's track: from the plan's start
along the route's parts up to the route point nearest the goal and, when the route states a
descent, back down the same way — saved as GPX with terrain heights so the tour's climb, descent and
distance come from it and match the route's. Parts that do not connect SHALL fall back to the
route's longest part, run from the end nearer the start. The track SHALL stay editable on the map.

#### Scenario: Planning a ski route

- **WHEN** the user plans the route "Sustenhorn" (1640 m up and down) as a tour and saves it
- **THEN** the tour SHALL show the route's line as its track, and climb and descent close to the route's stated 1640 m each

#### Scenario: A variant branches off

- **WHEN** a route has a variant part branching to another top
- **THEN** the track SHALL run to the goal and leave the variant out
