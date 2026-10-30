## ADDED Requirements

### Requirement: Track section offers drawing

The form's track section SHALL be titled "Track" and sit after the activity. Without a track it
SHALL offer "Draw on map" beside "Upload GPX track"; with one it SHALL keep replace and remove and
add "Edit on map". While a drawing's heights load, the section SHALL say so and Save SHALL wait.

#### Scenario: Empty track section

- **WHEN** the user opens a new tour's form
- **THEN** the track section SHALL offer "Draw on map" and "Upload GPX track"

### Requirement: Unsaved track on the map

While the open form holds a drawn or picked track not saved yet, the map SHALL draw it in the
drawing's style in place of the tour's saved track; a removed track SHALL hide the saved one. Saving
or leaving the form SHALL restore the saved display.

#### Scenario: After Done

- **WHEN** the user finishes a drawing while editing a tour that has a saved track
- **THEN** the map SHALL show the new line and not the saved one until the edit is saved or cancelled
