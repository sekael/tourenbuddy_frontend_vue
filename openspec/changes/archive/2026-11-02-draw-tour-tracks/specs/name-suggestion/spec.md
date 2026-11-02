## MODIFIED Requirements

### Requirement: Name auto-suggestion on location confirm

After the user confirms a map location, the tour form SHALL open at once and look up a name for that point's name field on its own, independently of the elevation lookup. A name chosen in the picker's search SHALL be used instead of the lookup. The point's name and elevation SHALL show together, once both lookups have answered or failed.

#### Scenario: Name loading

- **WHEN** the name or elevation lookup for a picked point is still running
- **THEN** the name field SHALL show a quiet pulsing bar in place of its text, with no spinner and no loading hint
- **AND** a name already answered SHALL appear only together with the elevation

#### Scenario: Name suggested and accepted

- **WHEN** a name suggestion is available and the user does not modify it
- **THEN** the tour SHALL be created with the suggested name

#### Scenario: Name suggested but overridden

- **WHEN** a name suggestion is available and the user types a different name
- **THEN** the tour SHALL use the user-entered name

#### Scenario: No suggestion available

- **WHEN** no name suggestion is returned (nothing nearby, timeout, API error)
- **THEN** the name field SHALL stay empty with the placeholder "Not available from Swisstopo – enter manually" (or its localized equivalent)

#### Scenario: User types while the lookup runs

- **WHEN** the user types in the name field before the lookup answers
- **THEN** the field SHALL show what is typed, the request SHALL be aborted, and no later answer SHALL replace the typed name

#### Scenario: Re-pick keeps a typed name

- **WHEN** the user has typed a name and then re-picks the point
- **THEN** no name lookup SHALL run for that field and the typed name SHALL stay
- **AND** a name the form filled itself or was opened with SHALL be replaced by the new point's name
