## MODIFIED Requirements

### Requirement: Availability data model

The system SHALL persist user availability in a `user_availability` table keyed by the
composite primary key `(user_id, date)`, where `date` is a calendar date (no time component).
A given user MUST NOT have more than one row for the same date. Each row SHALL additionally
carry an `available` boolean and a `source` of either `manual` or `calendar`. A day SHALL be
treated as available by every reader if and only if a row exists for it with
`available = true`; a row with `available = false` is a **tombstone** recording that the user
deliberately cleared that day. Rows SHALL be exposed via the Data API (explicit grants) and
governed by Row-Level Security. The table shape SHALL support group-intersection queries
(grouping availability by date across a set of users) without a schema change.

#### Scenario: Marking a day available creates exactly one row

- **WHEN** a user marks 2026-08-14 as available
- **THEN** exactly one `user_availability` row exists with that user's id, `date = 2026-08-14`,
  `available = true` and `source = 'manual'`

#### Scenario: The same day cannot be duplicated

- **WHEN** a write attempts to insert a second row for a `(user_id, date)` that already exists
- **THEN** the composite primary key rejects it and no duplicate is created

#### Scenario: A tombstone is not readable as availability

- **WHEN** a row exists with `available = false` for a given `(user_id, date)`
- **THEN** neither the user's own availability query nor a friend's availability query returns
  that date, and the Planned calendar shows no overlay for it

#### Scenario: Reading availability is unaffected for a user with no calendar feed

- **WHEN** a user who has never connected a calendar feed marks and clears days
- **THEN** their availability rows carry `source = 'manual'`, cleared days are deleted outright
  rather than tombstoned, and no tombstone rows accumulate

### Requirement: Save persists availability as a diff

On **Save**, the system SHALL persist the difference between the edited selection and the
availability set loaded when edit mode was entered: newly selected days SHALL be marked
available and cleared days SHALL cease to be available. The insert and the removal SHALL be
applied atomically (all-or-nothing) so a failure never leaves the availability half-applied.
Days that were unchanged SHALL NOT be rewritten. Every day written by this operation SHALL be
recorded with `source = 'manual'`. Where the user has at least one connected calendar feed, a
cleared day SHALL be recorded as a tombstone rather than deleted, so that a subsequent calendar
sync cannot re-add it; where the user has no connected feed, a cleared day SHALL be deleted.
After a successful save the calendar SHALL return to view mode reflecting the saved
availability.

#### Scenario: Added and removed days both persist

- **WHEN** the user marks one new day, clears one previously marked day, and taps Save
- **THEN** the new day becomes available and the cleared day ceases to be available, and no
  other availability rows change

#### Scenario: Unchanged days are not rewritten

- **WHEN** the user opens edit mode, changes nothing, and taps Save
- **THEN** no write is issued

#### Scenario: A failed save leaves availability unchanged

- **WHEN** the save operation fails partway
- **THEN** neither the additions nor the removals are applied and the stored availability is
  exactly as it was before the save

#### Scenario: Clearing a calendar-derived day survives the next sync

- **WHEN** a user with a connected feed clears a day that the feed had marked available, and a
  sync then runs while that day is still free in the source calendar
- **THEN** the day remains unavailable, because the manual tombstone takes precedence

#### Scenario: Manually marking a day the calendar calls busy survives the next sync

- **WHEN** a user marks a day available that the feed derives as busy, and a sync then runs
- **THEN** the day remains available

## ADDED Requirements

### Requirement: Calendar-derived availability never overwrites a manual decision

A calendar sync SHALL write, update and delete only rows with `source = 'calendar'`. It MUST
NOT insert, update or delete any row with `source = 'manual'`, whether that row is available or
a tombstone. This precedence SHALL be enforced by the database routine that applies a sync,
not only by the caller.

#### Scenario: Sync leaves a manual row untouched

- **WHEN** a sync runs for a day that already has a `source = 'manual'` row
- **THEN** that row is unchanged in both `available` and `source`

#### Scenario: Sync removes a day the calendar no longer frees

- **WHEN** a day previously written with `source = 'calendar'` becomes busy in the source
  calendar and a sync runs
- **THEN** that calendar-derived row is removed and the day shows no overlay

#### Scenario: A rogue caller cannot delete manual rows through the sync routine

- **WHEN** the sync routine is invoked with a day range that spans manually pinned days
- **THEN** the manual rows in that range survive the call

### Requirement: The Planned calendar explains calendar-derived availability

When the user has at least one connected calendar feed, availability edit mode SHALL state that
availability is pre-filled from their calendar and that tapping a day overrides it permanently.
Calendar-derived and manually marked days SHALL render identically, with no provenance styling.

#### Scenario: Edit mode explains the override

- **WHEN** a user with a connected feed enters availability edit mode
- **THEN** the existing friend-visibility disclaimer is accompanied by a note that days come
  from their calendar and that a tap pins the day

#### Scenario: No note without a feed

- **WHEN** a user with no connected feed enters availability edit mode
- **THEN** no calendar note is shown and edit mode is exactly as before
