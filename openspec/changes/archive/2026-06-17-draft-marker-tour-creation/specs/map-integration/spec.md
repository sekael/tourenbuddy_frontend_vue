## MODIFIED Requirements

### Requirement: Edit-mode preview marker matches tour type

When a user is editing an existing tour's goal location **or creating a new tour**, the map SHALL render a tentative draft preview circle at the candidate goal coordinates. The preview circle's color SHALL be a lighter variant of the relevant tour's type-based color, preserving the "tentative / not yet committed" visual cue. During editing the relevant type is the selected tour's type; during creation it is the activity type currently selected in the creation form. When no type is selected yet (including the start of creation before any activity is chosen) or the type is null, the preview SHALL use the neutral-light fallback color.

During creation, picking a goal SHALL show the draft marker, and re-picking the goal SHALL move the single existing draft marker rather than adding a second one. When the user selects or changes the activity type in the creation form, the draft marker's color SHALL update to the matching lighter shade within the same reactive tick. On save the draft marker SHALL remain visible through the create round-trip and SHALL be cleared only once the real, full-color marker exists, so the light draft visibly transforms into the saved marker with no intervening empty-map gap. If the create fails, the draft marker SHALL still be cleared.

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
