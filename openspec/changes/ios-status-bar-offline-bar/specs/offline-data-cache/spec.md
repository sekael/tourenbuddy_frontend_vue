## ADDED Requirements

### Requirement: The offline status takes its own band at the top

While the app is offline (or on an unverified session), or changes wait to sync, a slim bar below the system status bar SHALL say so in one line: offline with saved data, offline with the number of changes waiting, or, back online, the number still waiting to sync until they have synced. The bar SHALL take its own band: every page, sheet, drawer, dialog and overlay SHALL start below it, so it never covers a control, and the band SHALL open and close smoothly rather than in one jump.

#### Scenario: Going offline with the tour form open

- **WHEN** the device goes offline while the new-tour form is open
- **THEN** the bar reads "Offline · showing saved data" and the form's header, with close and Save, glides below it fully visible

#### Scenario: Offline on the map

- **WHEN** the device goes offline on the map
- **THEN** the bar sits at the top over the map and no map control, the tour bar or the legend button is covered

#### Scenario: Back online with changes waiting

- **WHEN** the device comes back online while 2 changes are queued
- **THEN** the bar reads "2 changes waiting to sync" until they have synced, then closes, and a brief "2 changes synced" message confirms it

#### Scenario: A change fails to sync

- **WHEN** the queue drains but a change is dead-lettered on the way
- **THEN** no "synced" message shows; the dead-letter banner reports the change instead

#### Scenario: Online with nothing waiting

- **WHEN** the app is online, the session is verified and nothing is queued
- **THEN** no bar shows and no band is taken
