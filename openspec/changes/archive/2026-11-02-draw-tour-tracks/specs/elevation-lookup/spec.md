## MODIFIED Requirements

### Requirement: Elevation auto-fill on location confirm

After the user confirms a map location, the tour form SHALL open at once and look up the elevation for that point's elevation field on its own, independently of the name lookup. The point's name and elevation SHALL show together, once both lookups have answered or failed.

#### Scenario: Elevation loading

- **WHEN** the elevation or name lookup for a picked point is still running
- **THEN** the elevation field SHALL show a quiet pulsing bar in place of its text, with no spinner and no loading hint
- **AND** the name field SHALL hold its bar too until the elevation has answered or failed

#### Scenario: Elevation pre-filled

- **WHEN** the elevation lookup succeeds
- **THEN** the elevation field SHALL be filled with the retrieved value, shown together with the name once the name lookup has answered or failed
- **AND** the user SHALL be able to manually override the value

#### Scenario: Elevation lookup fails

- **WHEN** the elevation lookup returns null (timeout, API error, outside Switzerland)
- **THEN** the elevation field SHALL stay empty with the placeholder "Not available from Swisstopo – enter manually" (or its localized equivalent)

#### Scenario: User types while the lookup runs

- **WHEN** the user types in the elevation field before the lookup answers
- **THEN** the field SHALL show what is typed, the request SHALL be aborted, and no later answer SHALL replace the typed value

#### Scenario: Re-pick keeps a typed elevation

- **WHEN** the user has typed an elevation and then re-picks the point
- **THEN** no elevation lookup SHALL run for that field and the typed value SHALL stay
- **AND** an elevation the form filled itself or was opened with SHALL be replaced by the new point's lookup
