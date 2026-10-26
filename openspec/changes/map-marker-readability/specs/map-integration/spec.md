## MODIFIED Requirements

### Requirement: Tour markers rendered as circles

Tours SHALL be rendered on the map as circle markers using a MapLibre circle layer backed by a GeoJSON source. The circle color SHALL be derived from the tour's activity types, grouped as: winter sports (skiing, snowboarding, skitour, splitboarding, ski-mountaineering) in blue, summer sports (hiking, mountaineering, climbing, trailrunning) in red, mountain-biking in violet, paragliding in amber, and tours with no type in neutral grey. A tour whose types map to more than one of these colors SHALL render split between them (see "Multi-activity markers split between their colours").

Every goal circle SHALL carry a thin white ring, and a tour with at least one activity SHALL show the white glyph of its primary (first) activity centred in the circle, so that each activity is recognisable within a colour family and app markers never read as basemap symbols. A tour without an activity SHALL show no glyph.

Each GeoJSON feature SHALL additionally carry a `completed` boolean property mirroring the tour's `completed` field. A completed tour SHALL show a completion badge (a small green disc with a white check) on the lower right edge of its circle. A friend tour SHALL show a friendship badge, and a linked tour a link badge instead, on the lower left edge. The circle radius and stroke for completed tours SHALL remain identical to not-completed tours. Selected-state styling (larger radius, thicker white stroke) SHALL apply to completed tours identically, and the badges SHALL still render on top of the selected-state circle. Clicking a completed tour's marker SHALL trigger the same selection and fly-to behavior as a not-completed tour. GPX track rendering SHALL be unaffected by completion state. Not-completed tours SHALL render with no completion badge.

#### Scenario: Tours displayed on map

- **WHEN** the tours store has loaded tours
- **THEN** each tour SHALL appear as a circle marker at its goal coordinates

#### Scenario: Selected tour highlighted

- **WHEN** a user clicks on a tour circle
- **THEN** the selected tour SHALL render with a larger radius (18px vs default 14px) and a white stroke

#### Scenario: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

#### Scenario: Winter tour colored blue

- **WHEN** a tour's types are all among skiing, snowboarding, skitour, splitboarding, or ski-mountaineering
- **THEN** its circle marker SHALL render in the winter (blue) palette color

#### Scenario: Summer tour colored red

- **WHEN** a tour's types are all among hiking, mountaineering, climbing, or trailrunning
- **THEN** its circle marker SHALL render in the summer (red) palette color

#### Scenario: Paragliding tour colored amber

- **WHEN** a tour's only type is paragliding
- **THEN** its circle marker SHALL render in the paragliding (amber) palette color

#### Scenario: Unknown tour type falls back to neutral

- **WHEN** a tour has no activity type
- **THEN** its circle marker SHALL render in the neutral (grey) fallback color with no activity glyph

#### Scenario: Activities of one colour tell apart

- **WHEN** one tour's primary activity is hiking and another's is mountaineering
- **THEN** both markers SHALL be red, one showing the hiking glyph and the other the mountaineering glyph

#### Scenario: Completed tour shows distinct visual

- **WHEN** a tour has `completed === true`
- **THEN** the marker SHALL show the completion badge on the lower right edge of the type-colored circle
- **AND** the circle radius and stroke SHALL be identical to not-completed markers

#### Scenario: Selected completed tour

- **WHEN** a completed tour becomes the selected tour
- **THEN** the marker SHALL show the selected-state larger radius and white stroke
- **AND** the completion badge SHALL remain rendered on top

#### Scenario: GPX track unaffected by completion

- **WHEN** a completed tour has a GPX track displayed on the map
- **THEN** the track SHALL render with the same style as for a not-completed tour

#### Scenario: Completion toggle reflects on map immediately

- **WHEN** a tour's `completed` field changes in the tours store
- **THEN** the corresponding map marker SHALL update its visual within the same reactive tick, with no page reload required

### Requirement: `splitZoom` is computed from world-meter centroid distance and pixel radius

For every internal tree node N with children C1 and C2, the `splitZoom` SHALL be computed as the zoom at which the projected pixel distance between `C1.centroid` and `C2.centroid` equals `CLUSTER_RADIUS = 50` pixels, using the standard Web Mercator pixels-per-meter formula evaluated at the merge node's centroid latitude. The post-build pass SHALL clamp every child's `splitZoom` to be greater than or equal to its parent's `splitZoom`, propagating recursively, to guarantee monotone visibility transitions during a continuous zoom. Building the tree SHALL NOT take time cubic in the number of tours; its merges SHALL equal those of an exhaustive closest-pair search.

#### Scenario: Two tours 100 m apart at latitude 47° have a deterministic `splitZoom`

- **GIVEN** two tour leaves at the same latitude 47.0° and exactly 100 m apart
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be the unique solution of `pixelDist = 50` per the Web Mercator formula
- **AND** the value SHALL be reproducible across builds for the same input

#### Scenario: Monotonicity clamp preserves child >= parent

- **GIVEN** centroid linkage produced a node N with `splitZoom = 9.0` whose parent P has `splitZoom = 9.5`
- **WHEN** the post-build clamp runs
- **THEN** `N.splitZoom` SHALL be set to `9.5` (or any value `>= 9.5`)

#### Scenario: Two tours at identical coordinates have effectively infinite `splitZoom`

- **GIVEN** two tour leaves at identical coordinates (distance = 0)
- **WHEN** the tree is built
- **THEN** their merge node's `splitZoom` SHALL be greater than the stack zoom
- **AND** tapping that cluster SHALL open the stack list

#### Scenario: Large tour sets build fast

- **WHEN** the tree is built for 600 tours
- **THEN** the build SHALL finish in well under 100 ms on a desktop browser

### Requirement: Cluster pies weight tours by their colours

A cluster pie SHALL give each member tour a total weight of one, divided equally among the tour's distinct colours, so slice sizes reflect tours rather than type counts. The number shown SHALL remain the count of tours. Stack-list colour dots and leaf tween dots of a split tour SHALL show its colours split the same way.

#### Scenario: Mixed cluster

- **WHEN** a cluster holds one ski tour and one ski-tour-and-hike tour
- **THEN** its pie SHALL be three quarters blue and one quarter red
- **AND** it SHALL show the count 2

## REMOVED Requirements

### Requirement: Cluster click navigates to `splitZoom + ε` or spiderfies if unreachable

**Reason**: a tap moved the zoom by as little as 0.04 levels and peeled off one tour at a time (5–6 taps to reach a tour), and the spiderfy fan was an unlabelled pile of dots whose taps leaked to the map.
**Migration**: replaced by "Cluster tap frames its tours or opens the stack list" and "Stack list for tours on the same spot".

## ADDED Requirements

### Requirement: Cluster tap frames its tours or opens the stack list

Tapping a cluster marker for node N SHALL ease the map to frame all of N's tours. The target zoom SHALL be the largest of `N.splitZoom + ε` (ε ≈ 0.01), the zoom that fits N's tours with a margin, and one level above the current zoom (so even a country-wide cluster's tap visibly drills in), capped at the map's maximum zoom. The split animation SHALL be the same one a user zoom fires. The fitted zoom SHALL NOT exceed 15.5 unless the split itself needs more, so a tap never lands at street level for no gain. The fit SHALL keep the tours clear of the bottom tour bar. When `N.splitZoom` exceeds the stack zoom (17), meaning the tours sit within metres of each other, the tap SHALL open the stack list instead and SHALL NOT zoom the map.

#### Scenario: Tap on a spread cluster separates it in one step

- **GIVEN** a cluster of four tours spread across 10 km at zoom 9.5
- **WHEN** the user taps it
- **THEN** the map SHALL ease so that all four tours are in view
- **AND** the target zoom SHALL be at least `splitZoom + ε`

#### Scenario: Tap on a same-spot stack

- **GIVEN** a cluster whose tours share one goal
- **WHEN** the user taps it
- **THEN** the stack list SHALL open
- **AND** the map SHALL NOT zoom

### Requirement: Stack list for tours on the same spot

The stack list SHALL be a popup anchored at the stack, titled with the number of tours there, with one row per tour. Opening it SHALL pan the map (without zooming) so the stack sits in the upper middle and the list opens below it within the screen, clear of the bottom tour bar. When not every row fits, the list SHALL scroll and SHALL show a shadow at the edge where more rows hide. Each row SHALL show:
- the tour's colour dot, split like its marker, carrying its primary activity's glyph and marked when completed
- its name, or the unnamed-tour label
- a second line with its date or date range, or "no date", or "done" for a completed tour

Rows SHALL be ordered:
1. planned tours with a date, earliest first
2. undated tours
3. completed tours

Tapping a row SHALL close the list and select that tour exactly as a marker tap does. The list SHALL close with its close button, Escape, a tap on the map, or a zoom. Opening SHALL move keyboard focus to the first row and closing SHALL return it to the cluster marker. Each row SHALL be a button whose accessible name is the tour's name.

#### Scenario: Open a tour from the stack

- **GIVEN** the stack list is open at Niederhorn with 11 tours
- **WHEN** the user taps the row "Mira R5 Outing Tag 1"
- **THEN** the list SHALL close and that tour's detail (or its outing overview) SHALL open

#### Scenario: Escape closes the list

- **WHEN** the stack list is open and the user presses Escape
- **THEN** the list SHALL close and focus SHALL return to the cluster marker

### Requirement: Marker taps do not reach the map

A tap on a cluster marker or a stack-list row SHALL NOT also be handled as a tap on the map background. It SHALL NOT close an open sheet, start a trail lookup or dismiss the stack list it opened.

#### Scenario: Selecting from the stack keeps the sheet open

- **WHEN** the user selects a tour from the stack list
- **THEN** its detail sheet SHALL open and stay open

### Requirement: The selected tour is never clustered

The selected tour SHALL always render as its own marker, excluded from clustering like a focused outing's segments. A cluster drawn on top of the selected tour (the stack it was picked from) SHALL be hidden while that tour is selected, so the selected marker is visible and no cluster count that changed with the framing zoom contradicts the list it was picked from. Instead, when other tours share the selected tour's spot (within 25 m), a small "+N" chip at the selected marker's upper left SHALL count them; tapping it SHALL open the stack list of all tours at that spot (the selected one included), opening upward so the open sheet does not cover it. Clusters that did not contain it SHALL keep their identity, without flicker or re-animation, when the selection changes.

#### Scenario: Selecting a tour inside a stack

- **GIVEN** a tour that sits inside a cluster of 14 at the current zoom
- **WHEN** the user selects it from the tour list
- **THEN** it SHALL render as the selected marker beside a cluster of 13

#### Scenario: Selecting a tour from a same-spot stack

- **GIVEN** a stack of 14 tours on one summit
- **WHEN** the user selects one of them
- **THEN** the selected marker SHALL show at the summit with no cluster covering it
- **AND** a "+13" chip SHALL sit at its upper left, and tapping it SHALL list all 14 tours
- **AND** the remaining tours SHALL show there again once the selection is cleared

### Requirement: Tour name labels

From zoom 10, every individually rendered tour marker SHALL show a label beside it with two lines:
1. the tour's name (or the unnamed-tour label)
2. for an outing segment its stage ("Etappe 2/3"), then its elevation and its date or date range; "no date" when undated; "done" instead of the date when completed

Labels SHALL avoid overlapping each other. Where they collide, lower-priority labels SHALL be dropped and basemap labels SHALL give way to tour labels. The selected tour's label and the focused outing's segment labels SHALL show at any zoom. Clustered tours SHALL have no label. Labels SHALL be localised and SHALL render with the base map's own fonts, including offline.

#### Scenario: Labels appear when zoomed in

- **WHEN** the map is at zoom 12 and a tour renders as an individual marker
- **THEN** its name SHALL be shown beside the marker, with its elevation and date below

#### Scenario: No labels at overview zoom

- **WHEN** the map is at zoom 9.5 and no tour is selected
- **THEN** no tour labels SHALL be shown

#### Scenario: Selected tour labelled at any zoom

- **WHEN** a tour is selected at zoom 9
- **THEN** its label SHALL be shown

### Requirement: Start and end markers are labelled

While a tour's start and end markers are shown, each SHALL carry a short label below it naming it as the start point or the end point. An outing's handover rings SHALL carry no label.

#### Scenario: Open tour with start and end

- **WHEN** a tour with a start and an end point is opened
- **THEN** the start marker SHALL be labelled "Startpunkt" and the end marker "Endpunkt" (de-CH)

### Requirement: Base-map symbols give way to tour markers

A base-map symbol (summit pictogram, place or height label, POI icon) that would be drawn under a tour marker SHALL be hidden, so it can never read as a second, dark marker. Base-map symbols beside a marker SHALL remain. Landmark summits, which the base map draws as dark pictogram discs, SHALL instead use the base map's ordinary summit symbol, keeping their names and heights.

#### Scenario: Landmark summit without a tour

- **WHEN** the map shows the Eiger at zoom 12 and no tour is there
- **THEN** the Eiger SHALL carry the ordinary summit symbol with its name and height, not a dark disc

#### Scenario: Tour on a summit

- **WHEN** a tour's goal is a summit that the base map marks with a summit pictogram
- **THEN** only the tour marker SHALL show at that spot

### Requirement: Cluster marker readability

A cluster marker SHALL show its pie as a ring wide enough to read the colour mix, its count in a legible size (at least 12 px for up to two digits) on a white centre, and a white outline with a soft shadow so it stands out from the base map. When any of its tours are completed it SHALL carry a green completion badge on its lower right: a bare check when all are completed, else a check with the number completed. Its accessible name, also its hover title, SHALL split its count by status: planned (dated), without a date, and done (e.g. "Cluster aus 14 Touren · 9 geplant · 4 ohne Datum · 1 erledigt"), omitting empty parts.

#### Scenario: Partly completed cluster

- **WHEN** a cluster holds three tours, one of them completed
- **THEN** it SHALL show the count 3 and a green badge "✓ 1"

#### Scenario: Cluster on a busy base map

- **WHEN** a cluster renders over dense topo detail
- **THEN** its outline, ring colours and count SHALL remain distinguishable

### Requirement: Map controls leave the map tappable

The floating bottom controls (tour bar, menu and legend buttons) SHALL dock at the bottom edge of the screen (above the safe area), level with the location picker's controls, rather than floating above a strip of live map, so that an objective in the lower part of the map stays tappable.

#### Scenario: Objective near the bottom of a phone screen

- **WHEN** a tour marker sits 100 px above the bottom edge of a 852 px phone screen
- **THEN** a tap on it SHALL reach the marker, not a control
