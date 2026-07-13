## ADDED Requirements

### Requirement: Edit availability entry point on the Planned view

The Planned view SHALL provide an **Edit availability** extended floating action
button in the bottom-right corner, showing an icon and the visible localized text
label (English "Edit availability", German "Verfügbarkeit angeben"). The FAB SHALL
be positioned so it does not overlap the mobile bottom navigation bar. Activating
it SHALL switch the Planned view into edit-availability mode (defined by the
`calendar-availability` capability). While in edit mode the FAB SHALL be hidden and
the availability Save/Cancel controls SHALL be shown as a bottom action bar.

#### Scenario: FAB visible only on the Planned view in view mode

- **WHEN** the user is on the Planned view and not in edit mode
- **THEN** the Edit availability FAB is shown in the bottom-right corner

#### Scenario: Entry point absent on the Seasons view

- **WHEN** the user switches to the Seasons view
- **THEN** the Edit availability FAB is not shown

#### Scenario: FAB gives way to Save/Cancel in edit mode

- **WHEN** the user activates the FAB and enters edit mode
- **THEN** the FAB is hidden and a bottom action bar with Save and Cancel is shown

#### Scenario: FAB does not overlap the mobile bottom nav

- **WHEN** the Planned view is shown on a mobile viewport with the bottom
  navigation bar present
- **THEN** the Edit availability FAB is offset above the bottom nav bar and does
  not overlap it

### Requirement: Own-availability overlay in Planned day cells

The Planned view's day cells (desktop grid) and day rows (mobile list) SHALL
render the user's own-availability overlay without displacing existing tour
rendering. The overlay SHALL be present in both view mode and edit mode; in edit
mode the overlay reflects the in-progress selection.

#### Scenario: Tours and availability coexist in a cell

- **WHEN** a day has both a planned tour and the user's availability
- **THEN** the cell shows the tour pill(s) and the availability overlay together,
  with neither hidden by the other

#### Scenario: Overlay reflects the live selection in edit mode

- **WHEN** the user toggles a day in edit mode
- **THEN** that day's overlay appears or disappears immediately, before saving
