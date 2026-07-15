## MODIFIED Requirements

### Requirement: Owner controls own availability

The system SHALL allow an authenticated user to create, read, and delete only
their own availability rows, and SHALL additionally allow an authenticated user
to read the availability rows of any user with whom they have an accepted
friendship. A user MUST NOT be able to create, modify, or delete another user's
availability rows. A user MUST NOT be able to read the availability rows of a user
who is neither themselves nor an accepted friend.

#### Scenario: User reads own and friends' availability

- **WHEN** an authenticated user queries `user_availability`
- **THEN** they receive rows where `user_id` equals their own id **or** where
  `user_id` belongs to a user with whom they have an accepted friendship, and no
  other rows

#### Scenario: Non-friend availability is not readable

- **WHEN** an authenticated user queries `user_availability` for a `user_id` that
  is neither their own nor an accepted friend
- **THEN** RLS returns no rows for that user

#### Scenario: User cannot write another user's availability

- **WHEN** an authenticated user attempts to insert a `user_availability` row
  with a `user_id` other than their own
- **THEN** RLS rejects the write

#### Scenario: User cannot write a friend's availability

- **WHEN** an authenticated user attempts to insert or delete a
  `user_availability` row belonging to an accepted friend
- **THEN** RLS rejects the write and the friend's rows are unchanged

#### Scenario: User cannot delete another user's availability

- **WHEN** an authenticated user attempts to delete a `user_availability` row
  belonging to another user
- **THEN** RLS rejects the delete and the row remains

## ADDED Requirements

### Requirement: Friends' availability is shown on the Planned calendar

The Planned calendar SHALL display, for every future day on which an accepted
friend is available, that friend as a contact chip on that day — **independent of
whether the viewer is available on that day**. Own available days SHALL keep their
existing green overlay; friend chips are additive and MUST NOT depend on the
viewer's own availability. A day the viewer is available on but no friend is
available on SHALL show the green overlay with no friend chips. Past days SHALL
NOT show friend availability.

Each friend chip SHALL be labelled with the viewer's own contact name for that
friend (the name as stored in the viewer's contacts), because every friend is by
construction one of the viewer's contacts. When a friend's `userId` has not yet
been resolved to a contact, the chip SHALL fall back to the friend's registered
profile name (resolved by user id) and render without an actionable menu, rather
than showing a blank chip or erroring.

#### Scenario: Friend chip on a day the viewer is not available

- **WHEN** a friend is available on 2026-08-20 and the viewer is not
- **THEN** the calendar shows that friend as a chip on 2026-08-20 with no green
  overlay

#### Scenario: Friend chip on a day the viewer is also available

- **WHEN** both the viewer and a friend are available on 2026-08-21
- **THEN** the calendar shows the green overlay **and** the friend's chip on
  2026-08-21

#### Scenario: Past friend availability is not shown

- **WHEN** a friend has availability on a date before today
- **THEN** no friend chip is shown for that past date

#### Scenario: Friend chips coexist with planned tours on the same day

- **WHEN** a day has both a planned tour and an available friend
- **THEN** the tour is shown as a tour pill and the friend as a separate neutral
  chip, each capped independently, without one suppressing the other

### Requirement: Crowded days collapse into a per-day detail list

For each kind (tours, friends) a day cell SHALL, when exactly one item is present,
show that item as its chip; when more than one is present, show instead a single
generic count chip (**"N tours"** / **"N friends"**) and no individual item; and
when none is present, show nothing. The cell MUST NOT overflow its bounds (content
is clipped). Tapping any non-empty day — outside availability edit mode — SHALL
open a per-day **detail list** containing that day's planned tours first, then its
available friends, ordered alphabetically by the viewer's contact name. The detail
list SHALL be presented as a bottom sheet on mobile and a dialog on desktop,
layered over the calendar; closing it SHALL return to the calendar at its prior
scroll position.

#### Scenario: Crowded cell collapses each kind to a count chip

- **WHEN** a day has two or more tours and two or more available friends
- **THEN** the cell shows a single "N tours" count chip and a single "N friends"
  count chip — no individual tour pill or friend chip — clipped to the cell bounds

#### Scenario: A lone item of a kind is shown as itself

- **WHEN** a day has exactly one tour and exactly one available friend
- **THEN** the cell shows that tour's pill and that friend's chip (no count chips)

#### Scenario: Tapping a non-empty day opens its detail list

- **WHEN** the viewer taps a non-empty day in view mode
- **THEN** a per-day detail list opens, listing the day's planned tours first and
  its available friends second

#### Scenario: Empty day does not open a detail list

- **WHEN** the viewer taps a day with no tours and no available friends
- **THEN** no detail list opens

#### Scenario: Availability edit mode is unaffected

- **WHEN** the viewer taps a day while editing availability
- **THEN** the tap toggles that day's own availability and no detail list opens

### Requirement: Friend rows expose call and message actions from a contact

The system SHALL present, when the viewer taps an available friend in the per-day
detail list, the same call / message options used elsewhere for a contact (the
shared contact-action menu), resolved from that friend's contact. A friend whose
contact cannot currently be resolved MUST NOT present broken actions.

#### Scenario: Tapping a friend row offers contact actions

- **WHEN** the viewer taps an available-friend row in the per-day detail list
- **THEN** the shared contact-action menu opens with call / message options for
  that friend

#### Scenario: Unresolved friend row presents no broken actions

- **WHEN** the detail list contains a friend whose contact cannot be resolved
- **THEN** that row shows the friend's profile name and offers no contact actions

### Requirement: Availability synchronizes in realtime

The system SHALL keep availability current without a manual refresh. A change to
the viewer's own availability (from any device) SHALL be reflected in the viewer's
Planned calendar. A change to an accepted friend's availability SHALL be reflected
in the viewer's Planned calendar. Realtime updates SHALL be scoped so that a user
only receives availability change signals for themselves and their accepted
friends, never for unrelated users.

#### Scenario: A friend's availability change appears live

- **WHEN** an accepted friend marks a new future day available while the viewer is
  on the Planned calendar
- **THEN** the viewer's calendar shows a chip for that friend on that day without a
  manual refresh

#### Scenario: A friend clearing availability is reflected live

- **WHEN** an accepted friend clears a previously available future day
- **THEN** the viewer's calendar removes that friend's chip from that day without a
  manual refresh

#### Scenario: Own availability syncs across devices

- **WHEN** the viewer marks a day available on one device
- **THEN** the viewer's Planned calendar on another signed-in device reflects it
  without a manual refresh

#### Scenario: Unrelated users receive no signal

- **WHEN** a user who is not an accepted friend of the viewer changes their
  availability
- **THEN** the viewer receives no availability change signal for that user
