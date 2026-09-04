## ADDED Requirements

### Requirement: Map route never scrolls the document

While the map route is mounted, the document SHALL NOT scroll by any means: wheel, touch
pan, momentum/inertial scroll, rubber-band overscroll, or browser-chrome collapse. The map
SHALL be navigable only through its own gestures — drag, pinch, and rotate.

The lock SHALL be applied for the entire mounted lifetime of the route, not only while the
location picker is active, and SHALL be released when the route is left so every other
route scrolls normally.

Pinning the page element alone SHALL NOT be considered sufficient: the document root and
body SHALL both be pinned, because suppressing overflow alone does not stop momentum,
rubber-band, or address-bar scroll on iOS.

#### Scenario: Scroll gesture outside the map canvas

- **WHEN** the map route is mounted
- **AND** the user performs a scroll or overscroll gesture on any non-canvas surface (a sheet edge, the tour action bar, the picker button row, the page background)
- **THEN** the document scroll offset SHALL remain unchanged
- **AND** the map canvas SHALL NOT move relative to the viewport

#### Scenario: Location picker crosshair stays over the aimed point

- **WHEN** the location picker is active
- **AND** the user performs a scroll or overscroll gesture anywhere outside the map canvas
- **THEN** the geographic point resolved on confirm SHALL be the point the crosshair was rendered over before the gesture

#### Scenario: Lock released on leaving the route

- **WHEN** the user navigates from the map route to any other route
- **THEN** the document scroll lock SHALL be released
- **AND** the destination route SHALL scroll normally

#### Scenario: Lock survives a concurrent release by a leaving route

- **WHEN** the map route is mounted and holds the lock
- **AND** another route that also held the lock unmounts afterwards
- **THEN** the document SHALL remain locked while the map route stays mounted

### Requirement: Map gestures remain available while an overlay is open

Suppressing document scroll SHALL NOT suppress the map's own gestures. While the map route
is mounted — including while a bottom sheet, dialog, or side drawer covers part of the map
— wheel-zoom, pinch-zoom, drag-pan, and rotate over the still-visible portion of the map
SHALL continue to work.

The document scroll lock SHALL therefore be applied at the document root and body only, and
SHALL NOT declare `touch-action` there, so that no gesture policy is imposed on the map
canvas or on any scroll region inside an overlay.

#### Scenario: Wheel zoom beside an open side drawer

- **WHEN** a side drawer is open over part of the map on desktop
- **AND** the user scroll-wheels over the still-visible portion of the map
- **THEN** the map SHALL zoom about the pointer
- **AND** neither the document nor the drawer content SHALL scroll

#### Scenario: Touch gestures beside an open bottom sheet

- **WHEN** a bottom sheet is open over part of the map on a touch device
- **AND** the user drags, pinches, or rotates on the still-visible portion of the map
- **THEN** the map SHALL pan, zoom, or rotate accordingly

#### Scenario: Overlay content still scrolls while the document is locked

- **WHEN** the map route is mounted and an overlay's content overflows its scroll region
- **THEN** that content SHALL scroll by touch and by wheel within the overlay

## MODIFIED Requirements

### Requirement: Location picker with crosshair

The map SHALL support a location-picking mode where a crosshair overlay appears at the center of the viewport, and the user can pan to choose a location. While picking is active, the location picker SHALL be the only interactive UI; any open tour edit or tour creation surface SHALL be suspended (collapsed to a title-only header, inputs disabled, dismissal affordances hidden) and any submit path SHALL refuse to execute until picking ends. On confirm or cancel, picking ends and the suspended surface SHALL be restored to its prior interactive state.

A suspended surface SHALL remain scrollable within its own scroll region while picking is
active, so the user can read the fields the pick will populate. Scroll inside such a
surface SHALL NOT reach the map.

#### Scenario: Enter location picker mode

- **WHEN** the user clicks the "Add Location" button
- **THEN** a crosshair overlay SHALL appear at the center of the map, the map action buttons SHALL hide, and cancel/continue FABs SHALL appear

#### Scenario: Confirm location

- **WHEN** the user clicks "Continue" in location picker mode
- **THEN** the app SHALL capture the map center coordinates and open the tour creation dialog with those coordinates

#### Scenario: Cancel location picking

- **WHEN** the user clicks "Cancel" in location picker mode
- **THEN** the crosshair SHALL disappear, the map action buttons SHALL reappear, and no tour is created

#### Scenario: Disabled when not logged in

- **WHEN** the user is not authenticated
- **THEN** the "Add Location" button SHALL be disabled

#### Scenario: Suspends an open tour edit surface while picking

- **WHEN** the location picker is active
- **AND** a tour info sheet is open in edit mode
- **THEN** the tour edit surface SHALL render in a collapsed header-only state showing "Edit: <tour title>"
- **AND** all form inputs and non-picker action buttons inside the edit surface SHALL be disabled
- **AND** backdrop / map-background / Escape dismissal of the edit surface SHALL be suppressed
- **AND** the edit surface SHALL NOT expose a close button

#### Scenario: Suspended surface remains readable while picking

- **WHEN** the location picker is active over a suspended edit or creation surface whose content overflows its scroll region
- **THEN** that content SHALL still scroll within the surface
- **AND** the map camera SHALL NOT change as a result of that scroll

#### Scenario: Suspends the tour creation dialog while re-picking

- **WHEN** the location picker is re-opened from within the tour creation dialog to pick start, end, or goal
- **THEN** the tour creation dialog SHALL be suspended equivalently (collapsed header, disabled inputs, dismissal suppressed) until picking ends

#### Scenario: Restores the suspended surface on confirm

- **WHEN** the user confirms the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the newly picked coordinates applied to the target field, and all other in-progress form values SHALL be preserved

#### Scenario: Restores the suspended surface on cancel

- **WHEN** the user cancels the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the target field unchanged, and all other in-progress form values SHALL be preserved
