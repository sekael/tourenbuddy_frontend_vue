## ADDED Requirements

### Requirement: Route step on the live map

Creating a tour SHALL start with a route step on the live map in which the start, the goal and the end
are set in that order, each by a tap on the map or by a search result, without a full-screen picker.
The start and the end MAY be skipped; the goal SHALL be required to continue. The end SHALL offer a
round trip back to the start once a start is set.

#### Scenario: Three points in one step

- **WHEN** the user taps "+", taps the map three times and continues
- **THEN** the form SHALL open with that start, goal and end, each named and with its height

#### Scenario: Search names the point

- **WHEN** the user chooses "Engstlenalp" in the search while the end is active
- **THEN** the end SHALL be set there with the name "Engstlenalp"

#### Scenario: Goal only

- **WHEN** the user skips the start and continues after setting the goal
- **THEN** the form SHALL open with the goal and no start or end

### Requirement: The route shows as points land

The route step SHALL draw the straight legs between the set points and SHALL show the climb and descent
of those legs from the points' heights as soon as two heights are known. A set point SHALL be movable
by dragging it.

#### Scenario: Climb and descent

- **WHEN** the start (1000 m) and the goal (2500 m) are set
- **THEN** the step SHALL show a climb of 1500 m and a descent of 0 m

#### Scenario: Dragging a point

- **WHEN** the user drags the goal to another place
- **THEN** the leg SHALL follow, and the goal's name and height SHALL be looked up again

### Requirement: Form changes go back to the map step

In the creation form, picking or changing the start, goal or end SHALL reopen the route step on that
point with all points of the stage shown; finishing SHALL hand only the moved points to the form, which
keeps every other field as it was.

#### Scenario: Moving the end from the form

- **WHEN** the user taps Change on the end point, taps the map elsewhere and taps Done
- **THEN** the form SHALL show the new end with its name and height and keep the typed tour name

### Requirement: Desktop creation form beside the map

On desktop the creation form SHALL open in the side drawer, like the tour details, and SHALL stay open
while points are set on the map beside it.

#### Scenario: Map visible while the form is open

- **WHEN** the creation form is open on a desktop screen
- **THEN** the map SHALL stay visible beside the drawer with the draft route on it
