## ADDED Requirements

### Requirement: Plan a tour from a ski route

A ski route's card SHALL offer "Plan as tour". It SHALL open the tour creation with the goal on
the route's target summit (named and high as the target), the start at the route end farthest
from it with the looked-up name and height, the activity ski tour, the route's difficulty as
grade, and the route name with the SAC link as description. Everything SHALL stay editable.

#### Scenario: Planning the Bundstock route

- **WHEN** the user opens the route "Von Tschingel" to the Bundstock (2756 m, WS+) and taps "Plan as tour"
- **THEN** the creation form SHALL open named "Bundstock" with goal height 2756, a start at the route's foot, activity ski tour and grade "WS+"

#### Scenario: The route ends on a variant

- **WHEN** a multi-part route's last point lies in the valley, away from its target "Furggegütsch (Hohgant)"
- **THEN** the goal SHALL be the summit Furggegütsch found by name near the route

#### Scenario: Search unavailable

- **WHEN** the place search fails (offline) or finds no same-named summit near the route
- **THEN** the route's last point SHALL be the goal
