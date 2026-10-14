# Spec Delta

## Purpose

Lets users tap a ski route shown by the ski-route overlay to identify it, see it highlighted and read its
details. It also provides the trail data (line geometry plus attributes) that later track drawing with trail
snapping builds on. Hiking trails are display-only: their category is already visible in the overlay's
symbology.

## ADDED Requirements

### Requirement: Tap identifies ski routes

When the ski-route overlay is on, the device is online and the map is at zoom 11 or closer, a map tap that hits no tour marker SHALL look up ski routes within the tap tolerance: 24 screen pixels for touch (coarse pointer), 10 for a mouse. The lookup SHALL NOT query hiking trails. Taps SHALL NOT trigger a lookup while picking a location, drawing an offline region, or offline.

#### Scenario: Tap on a ski route

- **WHEN** the ski-route overlay is on at zoom 13 and the user taps a ski route on the bare map
- **THEN** the app SHALL look up ski routes at the tap point and SHALL NOT query hiking trails

#### Scenario: Only hiking trails on

- **WHEN** only the hiking-trail overlay is on and the user taps a hiking trail
- **THEN** no lookup SHALL happen and the map SHALL behave as without overlays

#### Scenario: Tap on a tour marker

- **WHEN** the ski-route overlay is on and the user taps a tour marker lying on a route
- **THEN** the tour SHALL be selected as today and no lookup SHALL happen

#### Scenario: Picking a location

- **WHEN** the user is picking a tour location and taps on a ski route
- **THEN** no lookup SHALL happen

#### Scenario: Thumb-sized tolerance

- **WHEN** on a touch device the user taps 20 px beside a ski route
- **THEN** the route SHALL be found

### Requirement: Zoomed-out taps ask the user to zoom in

Below zoom 11, a tap that would otherwise look up ski routes SHALL NOT query and SHALL show a localized "Zoom in to see route details" snackbar.

#### Scenario: Tap at country zoom

- **WHEN** the ski-route overlay is on at zoom 8 and the user taps the bare map
- **THEN** the "Zoom in to see route details" snackbar SHALL appear and no lookup SHALL happen

### Requirement: Taps while a sheet is open

A background tap while the trail card is open SHALL run a new lookup: a hit SHALL replace the card's content, a miss SHALL close the card. A background tap while any other sheet is open SHALL only close that sheet, as today.

#### Scenario: Tap another route with the card open

- **WHEN** the trail card shows route A and the user taps route B
- **THEN** the card SHALL show route B and route A's highlight SHALL be gone

#### Scenario: Miss with the card open

- **WHEN** the trail card is open and the user taps where no route is found
- **THEN** the card and its highlight SHALL close

#### Scenario: Tap with a tour sheet open

- **WHEN** a tour's details are open and the user taps a ski route
- **THEN** the tour sheet SHALL close and no lookup SHALL happen

### Requirement: Several routes under the tap are listed

When a lookup finds exactly one route, the card SHALL open on its details. When it finds several, the card SHALL open as a list ordered by distance from the tap (nearest first), each row showing target · altitude and difficulty (or the route name / "Ski route" without info). At most 8 rows SHALL be shown, followed by a "+N more — zoom in" note. All listed routes SHALL be faintly highlighted. Choosing a row SHALL open that route's details with a back control to the list.

#### Scenario: Shared approach

- **WHEN** the user taps a forest track shared by three ski routes
- **THEN** the card SHALL list the three routes nearest-first and all three SHALL be faintly highlighted

#### Scenario: Pick from the list

- **WHEN** the user chooses the second row
- **THEN** the card SHALL show that route's details, only that route SHALL be fully highlighted, and back SHALL return to the list

#### Scenario: More than eight routes

- **WHEN** a lookup finds 12 routes
- **THEN** the list SHALL show the 8 nearest and a "+4 more — zoom in" note

#### Scenario: Miss

- **WHEN** the lookup finds no route
- **THEN** no highlight and no card SHALL appear, and nothing else on the map SHALL change

### Requirement: Selected route is highlighted

The selected route's full line geometry SHALL be drawn as a highlight above the overlays and below tour markers while the card is open. Closing the card SHALL remove all highlights. Highlights SHALL survive a base-map switch.

#### Scenario: Highlight follows the card

- **WHEN** the user closes the trail card
- **THEN** every route highlight SHALL disappear

#### Scenario: Highlight survives a base-map switch

- **WHEN** a route is highlighted and the user switches the base map
- **THEN** the highlight SHALL render again after the new base map loads

### Requirement: Trail card placement and framing

The trail card SHALL open as a bottom sheet on mobile and a side drawer on desktop, like tour details. It SHALL open only once the lookup has resolved, with its final content. When the highlighted geometry (all candidates in the list, the chosen route in details) is not fully visible beside the card, the map SHALL move to frame it; otherwise the camera SHALL NOT move. Selecting a tour SHALL close the trail card. The card SHALL credit swisstopo.

#### Scenario: Route hidden behind the sheet

- **WHEN** the card opens and part of the route lies under the sheet or drawer
- **THEN** the map SHALL fly so the whole route is visible beside it

#### Scenario: Route already visible

- **WHEN** the card opens and the whole route is already visible beside it
- **THEN** the camera SHALL NOT move

#### Scenario: Desktop

- **WHEN** the card opens on desktop
- **THEN** it SHALL appear as a side drawer, not a centered dialog

#### Scenario: Card opens with final content

- **WHEN** a lookup resolves with a route
- **THEN** the card SHALL open already showing its details or list, with no placeholder text that later changes

### Requirement: Ski route details

For a ski route with route information the card SHALL show, where present: route name, target and its altitude, difficulty, ascent time, ascent and descent in metres, and a link to the route in the SAC tour portal. Text and link SHALL use the UI language when Swisstopo provides it, else the untranslated original. Missing fields SHALL be omitted. A route without information SHALL show "Ski route" and a "No route information available" note.

#### Scenario: Route with full information

- **WHEN** the selected ski route has a name, target, difficulty, ascent time, ascent/descent and an SAC link
- **THEN** the card SHALL show all of them, and the SAC link SHALL open in a new tab

#### Scenario: Name missing in UI language

- **WHEN** the UI language is English and the route has only a German name
- **THEN** the card SHALL show the German name

#### Scenario: Route without information

- **WHEN** the selected ski route has no route information
- **THEN** the card SHALL show "Ski route" with the "No route information available" note and no empty fields

### Requirement: Lookup failures and stale results

A failed lookup (network error, non-OK response, or a response that fails validation) SHALL show a localized error snackbar and leave the map unchanged. A newer tap SHALL supersede a pending lookup: the older result SHALL never be shown.

#### Scenario: Network error

- **WHEN** the lookup request fails
- **THEN** a localized "Couldn't load route info" snackbar SHALL appear and no card SHALL open

#### Scenario: Two quick taps

- **WHEN** the user taps route A and then route B before A's lookup resolves
- **THEN** only route B SHALL be shown, even if A's response arrives last

### Requirement: Trail data includes full line geometry

Every route returned by a lookup SHALL carry its identity (overlay and feature id), its attributes, and its complete line geometry as one or more WGS84 longitude/latitude polylines, whether Swisstopo delivers a single line or a multi-line. This geometry SHALL be the one used for highlighting, distance ordering and framing.

#### Scenario: Multi-line ski route

- **WHEN** Swisstopo returns a ski route as a multi-line geometry
- **THEN** the route SHALL carry every part as its own polyline and the highlight SHALL draw all parts
