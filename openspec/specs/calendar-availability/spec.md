# calendar-availability Specification

## Purpose
Lets a user signal, edit, and persist their own per-day availability on the
Planned calendar. Availability is stored one row per available day and governed
by owner-only Row-Level Security. Friend read access and intersection display are
out of scope here and are introduced separately by #244; the data model is shaped
so that change is additive (no schema migration).
## Requirements
### Requirement: Availability data model

The system SHALL persist user availability as one row per available day in a
`user_availability` table keyed by the composite primary key `(user_id, date)`,
where `date` is a calendar date (no time component). A given user MUST NOT have
more than one row for the same date. Rows SHALL be exposed via the Data API
(explicit grants) and governed by Row-Level Security. The table shape SHALL
support future group-intersection queries (grouping availability by date across a
set of users) without a schema change.

#### Scenario: Marking a day available creates exactly one row

- **WHEN** a user marks 2026-08-14 as available
- **THEN** exactly one `user_availability` row exists with that user's id and
  `date = 2026-08-14`

#### Scenario: The same day cannot be duplicated

- **WHEN** a write attempts to insert a second row for a `(user_id, date)` that
  already exists
- **THEN** the composite primary key rejects it and no duplicate is created

### Requirement: Owner controls own availability

The system SHALL allow an authenticated user to create, read, and delete only
their own availability rows. A user MUST NOT be able to create, modify, or delete
another user's availability rows, and MUST NOT be able to read another user's
availability rows in this change (friend read access is introduced separately by
#244).

#### Scenario: User reads only own availability

- **WHEN** an authenticated user queries `user_availability`
- **THEN** they receive only rows where `user_id` equals their own id

#### Scenario: User cannot write another user's availability

- **WHEN** an authenticated user attempts to insert a `user_availability` row
  with a `user_id` other than their own
- **THEN** RLS rejects the write

#### Scenario: User cannot delete another user's availability

- **WHEN** an authenticated user attempts to delete a `user_availability` row
  belonging to another user
- **THEN** RLS rejects the delete and the row remains

### Requirement: Enter and exit edit-availability mode

The Planned calendar SHALL provide an **Edit availability** extended floating action
button (bottom-right, with a visible localized text label) that enters an edit mode.
On entering edit mode the system SHALL display a disclaimer stating that
availability will be visible to the user's friends, hide the FAB, and present
**Save** and **Cancel** controls as a bottom action bar. **Cancel**, or leaving the
Planned view by any means (switching views, back navigation), SHALL discard all
unsaved changes without a confirmation prompt and return to view mode. Entering edit
mode SHALL load the user's entire availability set from today onward, so any
previously marked future day can be cleared in the same session.

#### Scenario: Disclaimer shown on entering edit mode

- **WHEN** the user taps Edit availability
- **THEN** the calendar enters edit mode, shows the friend-visibility disclaimer,
  and shows Save and Cancel controls

#### Scenario: Cancel discards changes

- **WHEN** the user has toggled some days in edit mode and taps Cancel
- **THEN** no availability write occurs and the calendar returns to view mode
  showing the previously saved availability

#### Scenario: Navigating away discards changes without a prompt

- **WHEN** the user has toggled some days in edit mode and switches to the Seasons
  view or presses back
- **THEN** the edit is discarded with no confirmation dialog and no availability
  write occurs

#### Scenario: Existing future availability is loaded for editing

- **WHEN** the user enters edit mode and had previously marked a future day that
  is not in the current month view
- **THEN** that day is part of the editable set and can be cleared and saved,
  even though it was not marked during this session

### Requirement: Toggle and drag day selection

In edit mode, tapping a selectable day SHALL toggle its availability: an unmarked
day becomes marked, a marked day becomes unmarked. On the desktop grid, dragging
across a run of consecutive days SHALL apply the first day's direction (mark or
clear) to all days in the run. On mobile the calendar list SHALL remain
scrollable in edit mode, so selection is by single tap only (no swipe-select).
Days before today SHALL NOT be selectable.

#### Scenario: Tap toggles a day on and off

- **WHEN** the user taps an unmarked future day, then taps it again
- **THEN** the first tap marks it available and the second tap clears it

#### Scenario: Drag marks a consecutive run (desktop)

- **WHEN** the user drags the mouse across three consecutive future days on the
  desktop grid
- **THEN** all three days take the first day's direction (marked available)

#### Scenario: Past days are not selectable

- **WHEN** the user taps a day before today in edit mode
- **THEN** the day's availability does not change

### Requirement: Save persists availability as a diff

On **Save**, the system SHALL persist the difference between the edited selection
and the availability set loaded when edit mode was entered: newly selected days
SHALL be inserted and cleared days SHALL be deleted. The insert and delete SHALL be
applied atomically (all-or-nothing) so a failure never leaves the availability
half-applied. Days that were unchanged SHALL NOT be rewritten. After a successful
save the calendar SHALL return to view mode reflecting the saved availability.

#### Scenario: Added and removed days both persist

- **WHEN** the user marks one new day, clears one previously marked day, and taps
  Save
- **THEN** the new day is inserted, the cleared day is deleted, and no other
  availability rows change

#### Scenario: Unchanged days are not rewritten

- **WHEN** the user opens edit mode, changes nothing, and taps Save
- **THEN** no insert or delete is issued

#### Scenario: A failed save leaves availability unchanged

- **WHEN** the save operation fails partway
- **THEN** neither the inserts nor the deletes are applied and the stored
  availability is exactly as it was before the save

### Requirement: Render own availability overlay

The Planned calendar SHALL render the user's own available days with a
light-green overlay, in both view mode and edit mode. The overlay SHALL NOT
displace existing tour rendering on the same day.

#### Scenario: Saved availability is visible in view mode

- **WHEN** the user has saved availability for a day and is in view mode
- **THEN** that day shows the light-green availability overlay

#### Scenario: Overlay renders on a cold load without opening the editor

- **WHEN** the user opens the Planned view fresh (without entering edit mode) and
  has previously saved availability
- **THEN** their available days show the overlay, because own availability is
  loaded when the Planned view mounts

#### Scenario: Overlay coexists with a tour

- **WHEN** a day has both a planned tour and the user's availability
- **THEN** the cell shows the tour pill(s) and the availability overlay together,
  with neither hidden by the other
