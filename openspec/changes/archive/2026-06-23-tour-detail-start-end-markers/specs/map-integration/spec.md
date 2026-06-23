## ADDED Requirements

### Requirement: Start and end markers shown only while viewing or editing a tour's details

The map SHALL render a tour's **start** and **end** point markers ONLY while that tour's details are being viewed or edited (its info sheet is open, i.e. it is the selected tour) OR while a tour is being created. The standard map view, with no tour selected and no tour being created, SHALL NOT show any start or end markers. Start/end markers SHALL NOT participate in clustering, collision suppression, or the goal-marker click/selection behavior. Start/end markers SHALL be display-only (non-interactive): a tap on a start or end marker SHALL be swallowed — it SHALL NOT select a tour, fly to it, NOR dismiss the open info sheet or cancel an in-progress tour creation. The same start/end markers SHALL be shown for a partner friend tour's details exactly as for an owned tour, with no friend-specific icon on the start or end marker.

Start/end markers SHALL reuse the goal marker's GL rendering mechanism: a circle in the tour's type-based color with a sibling symbol layer carrying the icon, kept on a selection-scoped source separate from the clustering source, and rendered beneath the goal marker so the goal stays on top when they overlap.

A start/end marker SHALL reuse the goal marker's circle design and the tour's type-based color, distinguished by a centered white icon: the **start** marker SHALL carry the start icon and the **end** marker SHALL carry the end icon, matching the icons the tour info sheet uses for those points (`home` for start, `flag` for end). The completion check glyph SHALL remain on the goal marker only — completing a tour SHALL NOT change its start or end markers.

The **start** marker SHALL be shown whenever the tour has a start point. The **end** marker SHALL be shown ONLY when the tour has an end point that is distinct from the start point. A round-trip tour (end point equal to start point) and a one-way-to-goal tour (no end point) SHALL therefore show a start marker and no end marker, mirroring the info sheet's treatment.

When the tour's details are closed (deselected) the start/end markers SHALL be removed. On a map style switch the start/end markers SHALL be re-rendered for the still-selected tour, the same as the goal and GPX layers.

#### Scenario: Start and end markers appear when a tour's details open

- **WHEN** a tour with a start point and a distinct end point becomes the selected tour and its info sheet opens
- **THEN** a start marker SHALL render at the start point and an end marker at the end point, both in the tour's type-based color with the start/end icons respectively
- **AND** the goal marker SHALL continue to render as before

#### Scenario: No start/end markers on the standard map

- **WHEN** no tour is selected
- **THEN** no start or end markers SHALL be rendered anywhere on the map
- **AND** clustering and collision behavior SHALL be computed from goal markers only

#### Scenario: Round-trip tour shows start only

- **WHEN** the selected tour's end point equals its start point
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: One-way-to-goal tour shows start only

- **WHEN** the selected tour has a start point but no end point
- **THEN** a start marker SHALL render and NO end marker SHALL render

#### Scenario: Friend tour shows identical start/end markers

- **WHEN** a partner friend tour's details are open
- **THEN** its start/end markers SHALL render with the same design as an owned tour's, with no additional friend icon on the start or end marker

#### Scenario: Completion does not change start/end markers

- **WHEN** the selected tour is completed
- **THEN** the check glyph SHALL appear only on the goal marker
- **AND** the start and end markers SHALL render unchanged

#### Scenario: Tapping a start/end marker is swallowed, not dismissed

- **WHEN** the user taps a start or end marker while a tour's info sheet is open
- **THEN** no selection or fly-to SHALL occur (the goal marker remains the only selectable handle)
- **AND** the info sheet SHALL NOT close (the tap SHALL NOT be treated as a map-background click)

#### Scenario: Tapping a draft start/end marker does not cancel creation

- **WHEN** the user taps a start or end draft marker while creating a tour
- **THEN** the tour creation flow SHALL NOT be canceled

#### Scenario: Start/end markers removed on deselect

- **WHEN** the selected tour is deselected / its info sheet closes
- **THEN** the start and end markers SHALL be removed from the map

#### Scenario: Start/end markers survive a style switch

- **WHEN** the map base style is switched while a tour's details are open
- **THEN** the start and end markers SHALL be re-rendered for the still-selected tour after the new style loads

## MODIFIED Requirements

### Requirement: Edit-mode preview marker matches tour type

When a user is editing an existing tour's goal location **or creating a new tour**, the map SHALL render a tentative draft preview circle at the candidate goal coordinates. The preview circle's color SHALL be a lighter variant of the relevant tour's type-based color, preserving the "tentative / not yet committed" visual cue. During editing the relevant type is the selected tour's type; during creation it is the activity type currently selected in the creation form. When no type is selected yet (including the start of creation before any activity is chosen) or the type is null, the preview SHALL use the neutral-light fallback color.

During creation, picking a goal SHALL show the draft marker, and re-picking the goal SHALL move the single existing draft marker rather than adding a second one. When the user selects or changes the activity type in the creation form, the draft marker's color SHALL update to the matching lighter shade within the same reactive tick. On save the draft marker SHALL remain visible through the create round-trip and SHALL be cleared only once the real, full-color marker exists, so the light draft visibly transforms into the saved marker with no intervening empty-map gap. If the create fails, the draft marker SHALL still be cleared.

The same draft-preview mechanism SHALL extend to the **start** and **end** points. While creating or editing a tour, every set point (goal, start, end) SHALL be shown with its respective marker and icon. When a start or end location is changed during the edit/create flow, the changed point SHALL be shown as a lighter-tone draft marker carrying its start/end icon, in the same lighter shade rule used for the goal draft (type-based light color, or neutral-light when no type is selected). Unchanged points SHALL continue to render as their saved, full-color markers. On save, the start/end draft markers SHALL be promoted to saved markers the same way the goal draft is. Canceling the edit, or leaving a point's location unchanged, SHALL leave that point's marker unaffected.

#### Scenario: Preview for winter tour uses light blue

- **WHEN** the user is editing a tour of a winter type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter blue than the saved marker color

#### Scenario: Preview for summer tour uses light red

- **WHEN** the user is editing a tour of a summer type and has picked a new tentative goal
- **THEN** a circle marker SHALL appear at the tentative location in a lighter red

#### Scenario: Preview for paragliding tour uses light amber

- **WHEN** the user is editing a paragliding tour and has picked a new tentative goal
- **THEN** a circle marker SHALL appear in a lighter amber

#### Scenario: Draft marker appears on goal pick during creation

- **WHEN** the user picks a goal location to start creating a tour and no activity type has been chosen yet
- **THEN** a single draft preview circle SHALL appear at the picked goal in the neutral-light fallback color

#### Scenario: Re-picking the goal moves the draft marker

- **WHEN** the user changes the goal location during creation
- **THEN** the existing draft marker SHALL move to the new coordinates and NO additional draft marker SHALL be added

#### Scenario: Draft marker recolors live when activity type is selected during creation

- **WHEN** the user selects or changes the activity type in the creation form
- **THEN** the draft marker SHALL update to the matching lighter shade of that type's color within the same reactive tick

#### Scenario: Draft marker transforms into the saved marker on create

- **WHEN** the user saves the new tour
- **THEN** the draft marker SHALL stay on screen until the created tour is loaded into the store
- **AND** it SHALL then be replaced by the real activity-type-colored marker at the saved goal, with no empty-map gap during the create round-trip

#### Scenario: Draft marker cleared when create fails

- **WHEN** saving the new tour fails (e.g. the create request errors)
- **THEN** the draft marker SHALL be cleared rather than left dangling on the map

#### Scenario: Preview cleared on exit

- **WHEN** the user exits edit mode, cancels the tentative pick, or cancels tour creation
- **THEN** the preview circle SHALL disappear

#### Scenario: Changing a start point shows a draft start marker

- **WHEN** the user changes the start location while creating or editing a tour
- **THEN** a lighter-tone draft marker carrying the start icon SHALL appear at the new start location
- **AND** any unchanged goal or end markers SHALL keep their saved full-color rendering

#### Scenario: Changing an end point shows a draft end marker

- **WHEN** the user changes the end location while creating or editing a tour
- **THEN** a lighter-tone draft marker carrying the end icon SHALL appear at the new end location

#### Scenario: Start/end draft markers promote to saved on save

- **WHEN** the user saves edits that changed the start and/or end location
- **THEN** the changed point's draft marker SHALL become its saved, full-color marker

#### Scenario: Canceling edits leaves start/end markers unchanged

- **WHEN** the user cancels the edit, or leaves the start/end location unchanged
- **THEN** the start/end markers SHALL reflect the saved tour, with no lingering draft marker
