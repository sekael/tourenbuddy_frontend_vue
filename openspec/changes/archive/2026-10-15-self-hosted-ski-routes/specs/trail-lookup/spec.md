# Spec Delta

## MODIFIED Requirements

### Requirement: Clickable ski routes are marked

With the ski-route overlay on, at zoom 11 or closer, every ski route in view that carries route information SHALL be marked with a soft halo along its line and markers along the route that never overlap one another. Below zoom 11 the ski-route overlay SHALL still draw every route, unmarked. Routes without information SHALL NOT be marked. Marking SHALL come from the app's own ski-route dataset, without a request per pan beyond map tiles not yet loaded. Offline, routes SHALL be marked where their tiles are available (downloaded region or previously viewed).

#### Scenario: Marked routes

- **WHEN** the ski-route overlay is on at zoom 13
- **THEN** every ski route with route information in view SHALL show a halo and a marker, and routes without information SHALL look as on the plain overlay

#### Scenario: Below zoom 11

- **WHEN** the ski-route overlay is on at zoom 8
- **THEN** the ski routes SHALL be drawn and no route SHALL be marked

#### Scenario: Routes sharing a stretch

- **WHEN** several marked routes run along the same stretch (e.g. leaving the same hut)
- **THEN** their markers SHALL NOT overlap there, and each route SHALL still show a marker where its line is visible on its own

#### Scenario: Panning inside the loaded area

- **WHEN** the user pans over map tiles that have already loaded
- **THEN** no new request SHALL be made

#### Scenario: Offline in a downloaded region

- **WHEN** the device is offline inside a downloaded region with the ski-route overlay on at zoom 12
- **THEN** the routes SHALL be marked as online

### Requirement: Tap opens marked ski routes

A map tap that hits no tour marker SHALL, at zoom 11 or closer, find the marked routes within the tap tolerance: 24 screen pixels for touch (coarse pointer), 10 for a mouse. Only marked routes SHALL be found, each at most once however many map tiles it spans. The lookup SHALL NOT query hiking trails. Taps SHALL NOT look up routes below zoom 11, while picking a location, or drawing an offline region. Offline, a tap on a marked route SHALL NOT look it up and SHALL show a localized "Route details need a connection" snackbar; any other offline tap SHALL behave as without overlays.

#### Scenario: Tap on a marked route

- **WHEN** the ski-route overlay is on at zoom 13 and the user taps a marked ski route
- **THEN** its card SHALL open

#### Scenario: Tap at zoom 11

- **WHEN** the ski-route overlay is on at zoom 11.5 and the user taps a route's halo
- **THEN** its card (or the candidate list) SHALL open

#### Scenario: Tap below zoom 11

- **WHEN** the ski-route overlay is on at zoom 10.5 and the user taps the map
- **THEN** no lookup SHALL happen, no message SHALL appear, and an open trail card SHALL close

#### Scenario: Route spanning tiles under the tap

- **WHEN** the user taps where a route's line crosses a map tile edge
- **THEN** that route SHALL be listed once

#### Scenario: Tap on a route without information

- **WHEN** the user taps a ski route that is not marked
- **THEN** no card SHALL open

#### Scenario: Offline tap on a marked route

- **WHEN** the device is offline and the user taps a marked route
- **THEN** no lookup SHALL happen, no card SHALL open, and the "Route details need a connection" snackbar SHALL appear

#### Scenario: Offline tap beside the routes

- **WHEN** the device is offline and the user taps where no marked route is within tolerance
- **THEN** no snackbar SHALL appear and the map SHALL behave as without overlays

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

- **WHEN** on a touch device the user taps 20 px beside a marked ski route
- **THEN** the route SHALL be found

### Requirement: Lookup failures and stale results

When loading the found routes' details fails (network error, non-OK response, or a response that fails validation), a tap SHALL show a localized error snackbar, open no card and leave the map unchanged. A newer tap SHALL supersede a pending one: the older result SHALL never be applied.

#### Scenario: Network error

- **WHEN** loading a tapped route's details fails
- **THEN** a localized "Couldn't load route info" snackbar SHALL appear and no card SHALL open

#### Scenario: Second tap during a load

- **WHEN** the user taps route A and, before its details load, taps route B
- **THEN** only route B's card SHALL open, even if A's details arrive last

#### Scenario: Pan during a load

- **WHEN** the user pans the map before a tapped route's details have loaded
- **THEN** the card SHALL still open for the tapped route once they load

### Requirement: Trail data includes full line geometry

Every route shown in the card SHALL carry its identity (overlay and feature id), its attributes, and its complete line geometry as one or more continuous WGS84 longitude/latitude polylines. This geometry SHALL be the one used for highlighting, framing and the card, and SHALL NEVER be assembled from map-tile fragments, so a route crossing tile edges or partly off screen is still highlighted and framed whole.

#### Scenario: Multi-line ski route

- **WHEN** a ski route consists of several lines
- **THEN** the route SHALL carry every part as its own polyline and the highlight SHALL draw all parts

#### Scenario: Route partly off screen

- **WHEN** the user taps a route whose line continues beyond the viewport
- **THEN** the highlight SHALL cover the whole route and the map SHALL frame all of it

## ADDED Requirements

### Requirement: Dataset refresh while the app is running

When the ski-route dataset is republished while the app is open, the app SHALL switch to the new version without showing an error: routes SHALL keep rendering, and a tapped route's details SHALL load from the new version. A tapped route that no longer exists in the new version SHALL be treated as a miss, silently.

#### Scenario: Tap after a refresh

- **WHEN** the app loaded the previous version and the user taps a route after a refresh was published
- **THEN** the route's card SHALL open with the new version's details and no error SHALL appear

#### Scenario: Route removed in the new version

- **WHEN** the tapped route was removed in the new version
- **THEN** no card and no error SHALL appear, and the route SHALL no longer be marked once the map reloads its tiles

## REMOVED Requirements

### Requirement: Zoomed-out taps ask the user to zoom in

**Reason**: Routes are now marked from zoom 11 and nothing hints at tappable routes below it; a "zoom in" prompt for something the user cannot see is noise.
**Migration**: None. Below zoom 11 a tap behaves as with no overlay on (closes an open trail card).
