## ADDED Requirements

### Requirement: Connect calendar feeds

The system SHALL let a signed-in user connect up to 5 calendar feeds by supplying a secret
iCalendar (ICS) URL and an optional label, and SHALL let them relabel or disconnect any feed.
A feed URL MUST be `https`, MUST be unique per user, and SHALL be stored in an owner-only
table that no other user can read. When displaying a saved feed the system SHALL mask the URL
beyond its host, because the URL is a bearer credential granting read access to the user's
calendar. Attempting to connect a sixth feed SHALL be rejected with a localized message.

#### Scenario: Sixth feed is rejected

- **WHEN** a user with 5 connected feeds attempts to connect another
- **THEN** the write is rejected and a localized limit message is shown

#### Scenario: Duplicate feed URL is rejected

- **WHEN** a user connects a URL they have already connected
- **THEN** the write is rejected and no second row is created

#### Scenario: Non-https feed URL is rejected

- **WHEN** a user submits an `http://` or `webcal://` URL
- **THEN** the form rejects it before any request is made

#### Scenario: Another user cannot read a feed URL

- **WHEN** an authenticated user queries `user_calendar_feeds` for a row belonging to another
  user, including an accepted friend
- **THEN** RLS returns no rows

#### Scenario: Saved feed URL is masked in the UI

- **WHEN** a connected feed is listed
- **THEN** only its host and label are shown, never the full secret path

### Requirement: Configure the availability window

The system SHALL let a user configure a core window (`core_start`, `core_end`) and a minimum
free block (`min_free_minutes`) used to derive availability, defaulting to 06:00, 18:00 and 360
minutes. The system SHALL reject a configuration whose minimum free block exceeds the length of
the core window, both in the UI and by a database constraint.

#### Scenario: Unsatisfiable configuration is rejected

- **WHEN** a user sets the window to 04:00–12:00 and the minimum free block to 8 hours 1 minute
- **THEN** the configuration is rejected with a localized message and the previous settings
  remain in effect

#### Scenario: Window end before window start is rejected

- **WHEN** a user sets `core_end` earlier than or equal to `core_start`
- **THEN** the configuration is rejected

#### Scenario: Changed settings take effect on the next sync

- **WHEN** a user narrows their core window and triggers a sync
- **THEN** availability is recomputed against the new window and previously derived days that no
  longer qualify are removed

### Requirement: Derive available days from calendar busy time

For each day within the horizon, the system SHALL collect timed events from all of the user's
connected feeds, evaluate them in the `Europe/Zurich` timezone, clip each event to the day's
core window, merge overlapping busy intervals across **all** feeds, and mark the day available
if and only if the largest contiguous free interval within the core window is at least
`min_free_minutes`. All-day events SHALL be ignored entirely. Recurring events SHALL be expanded
across the horizon, honouring exceptions and cancellations. Events spanning more than one
calendar day SHALL contribute busy time to each day they overlap. Events whose `UID` identifies
them as originating from Tourenbuddy's own outbound feed SHALL be discarded before derivation.

#### Scenario: A short appointment does not consume the day

- **WHEN** the only event on a day is 08:00–09:00 and the window is 06:00–18:00 with a 6-hour
  minimum
- **THEN** the day is derived as available, because 09:00–18:00 is a 9-hour free block

#### Scenario: A full working day is busy

- **WHEN** a day holds a 09:00–17:00 event under the same settings
- **THEN** the day is derived as busy, because the largest free block is 06:00–09:00

#### Scenario: Busy time unions across feeds

- **WHEN** a work feed blocks 06:00–12:00 and a private feed blocks 12:00–18:00 on the same day
- **THEN** the day is derived as busy, even though each feed alone would leave a 6-hour block

#### Scenario: All-day events do not affect availability

- **WHEN** a day carries only an all-day event such as a birthday, a public holiday or a
  vacation entry
- **THEN** the day's derivation is identical to a day with no events at all

#### Scenario: A weekly recurrence blocks every occurrence

- **WHEN** a feed contains a weekly 09:00–17:00 recurring event
- **THEN** every occurrence within the horizon is derived as busy, and any occurrence removed
  by an exception is not

#### Scenario: A multi-day event blocks each day it spans

- **WHEN** an event runs from Friday 18:00 to Sunday 20:00
- **THEN** Saturday is derived as busy and Sunday's busy time is clipped to its local portion

#### Scenario: Events are evaluated in Swiss local time

- **WHEN** an event is published in UTC and overlaps the core window only after conversion to
  `Europe/Zurich`
- **THEN** derivation uses the converted local times

#### Scenario: Tourenbuddy's own tour events are ignored

- **WHEN** the user subscribes their calendar to the Tourenbuddy outbound feed and lists that
  same calendar as an inbound feed
- **THEN** tour events originating from Tourenbuddy are discarded and tour days are not derived
  as busy by their own entries

### Requirement: Sync writes only within a rolling horizon

A sync SHALL derive and write availability only for dates from today through 60 days ahead, and
SHALL NOT create, modify or delete availability outside that range. Tombstones for dates in the
past MAY be removed as housekeeping within the same operation.

#### Scenario: Days beyond the horizon are untouched

- **WHEN** a sync runs and the user's calendar is empty six months out
- **THEN** no availability is written for those dates

#### Scenario: Availability manually set beyond the horizon is preserved

- **WHEN** a user has manually marked a day 90 days out and a sync runs
- **THEN** that day remains available

### Requirement: A failing feed never widens availability

If any of a user's connected feeds cannot be fetched or parsed during a sync, the system SHALL
abort the sync for that user without writing any availability, SHALL preserve the previously
stored availability, and SHALL record a per-feed error that the UI surfaces next to the failing
feed. The system MUST NOT derive availability from the subset of feeds that responded.

#### Scenario: A rotated secret URL does not free the calendar

- **WHEN** a user rotates their calendar's secret address and the stored feed URL now returns
  403
- **THEN** no availability is written, previously derived days are unchanged, and the feed shows
  an error in the UI

#### Scenario: One failing feed aborts the whole run for that user

- **WHEN** one of two connected feeds times out and the other returns valid data
- **THEN** no availability is written for that user

#### Scenario: An unparseable body is a failure, not an empty calendar

- **WHEN** a feed returns 200 with a body that is not valid iCalendar
- **THEN** the sync fails for that user rather than deriving zero busy time

#### Scenario: A resolved error clears

- **WHEN** a previously failing feed succeeds on a later run
- **THEN** its recorded error is cleared and availability is written

### Requirement: Sync runs on a schedule and on demand

The system SHALL sync every user with at least one connected feed on a recurring schedule of at
most six hours, and SHALL additionally expose an authenticated on-demand sync that runs the
identical routine for the calling user only. The UI SHALL show when the user's feeds last synced
successfully. Within the same local day, a feed that reports no change since the last successful
fetch MAY be skipped; on the first run of a new local day the feed SHALL be fetched
unconditionally, because the horizon has rolled.

#### Scenario: On-demand sync is scoped to the caller

- **WHEN** an authenticated user triggers an on-demand sync
- **THEN** only their own feeds are fetched and only their own availability is written

#### Scenario: Unauthenticated on-demand sync is rejected

- **WHEN** the on-demand sync endpoint is called without a valid session token
- **THEN** it returns an authentication error and no sync runs

#### Scenario: Newly connected feed syncs without waiting for the schedule

- **WHEN** a user connects their first feed
- **THEN** a sync is triggered immediately and derived availability appears without waiting for
  the next scheduled run

#### Scenario: A rolled horizon forces a fresh fetch

- **WHEN** the first sync of a new local day runs against a feed that has not changed
- **THEN** the feed is fetched unconditionally and the full horizon is recomputed

### Requirement: Calendar content is never persisted

The system SHALL derive per-day booleans from feed content in memory and MUST NOT persist event
titles, descriptions, locations, organizers or attendees to any table, cache or log. Error
records SHALL identify a feed and a failure cause without including response bodies.

#### Scenario: A failure log carries no event data

- **WHEN** a feed fails mid-parse and the failure is recorded
- **THEN** the recorded error names the feed and the cause, and contains no calendar content

#### Scenario: Only dates are written

- **WHEN** a sync completes successfully
- **THEN** the only data written for the user is availability dates

### Requirement: Publish planned tours as a calendar feed

The system SHALL provide each user with a private iCalendar feed URL, containing a secret token,
that any calendar application can subscribe to. The feed SHALL contain the user's own tours that
have a planned date, plus tours linked to them, as all-day events on the planned date, and SHALL
be rendered from current data at request time rather than from a stored snapshot. Each event
SHALL carry a stable identifier marking it as Tourenbuddy-originated. An unknown token SHALL
return 404 and MUST NOT reveal whether the token ever existed.

#### Scenario: A linked tour appears in the feed

- **WHEN** a user's tour is linked to another user's tour with a planned date
- **THEN** the linked tour appears as an event in the feed

#### Scenario: A dissolved link disappears on the next refresh

- **WHEN** a tour link is dissolved and the calendar application refreshes the feed
- **THEN** the linked tour's event is absent, with no further action by either user

#### Scenario: A tour without a planned date is omitted

- **WHEN** the user has tours with no planned date
- **THEN** those tours produce no events

#### Scenario: An unknown token is not distinguishable

- **WHEN** the feed is requested with a token that does not resolve to a user
- **THEN** the response is 404 with no indication of whether the token was valid, revoked or
  never issued

#### Scenario: A deleted tour disappears on the next refresh

- **WHEN** a tour in the feed is deleted and the calendar application refreshes
- **THEN** its event is absent
