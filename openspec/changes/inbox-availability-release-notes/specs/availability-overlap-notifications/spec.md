# Spec Delta

## Purpose
Tell users when a friend becomes available on a future day they are available too, so they can plan a tour together, without pinging them for availability that doesn't line up.

## ADDED Requirements

### Requirement: Overlap event on newly available days
When one of a user's days today or later becomes available (manual mark, re-mark after clearing, or calendar sync), the system SHALL record an availability overlap event for every friend available on that day. Already-available days, cleared days and past days SHALL NOT produce an event, and the user whose availability changed SHALL NOT be a recipient.

#### Scenario: Manual mark overlaps
- **WHEN** A marks 2030-01-04 available and friend B is available on 2030-01-04
- **THEN** B gets one availability entry naming A and 2030-01-04, and A gets none

#### Scenario: No overlap
- **WHEN** A marks a day on which no friend is available
- **THEN** no entry is recorded

#### Scenario: Calendar sync adds a day
- **WHEN** A's calendar sync adds an available day that B is also available on
- **THEN** B gets an entry naming A, exactly as for a manual mark

#### Scenario: Unchanged day is silent
- **WHEN** A's calendar sync runs again without adding new days, or A re-saves an already-available day
- **THEN** no entry is recorded

#### Scenario: Past day ignored
- **WHEN** A marks a day before today that B is available on
- **THEN** no entry is recorded

#### Scenario: Non-friend never notified
- **WHEN** A marks a day that a non-friend is also available on
- **THEN** the non-friend gets no entry

### Requirement: One event per friend per write
A write that makes several days available SHALL produce at most one event per friend, listing every overlapping day.

#### Scenario: Several days in one write
- **WHEN** A marks three days at once and B is available on two of them
- **THEN** B gets one entry listing exactly those two days

### Requirement: Availability overlap delivery
Availability overlap events SHALL be delivered under the `availability` notification type: recorded in the inbox always, and sent by push and email subject to the recipient's mutes, email channel and registered push devices like every other type. Collapsing a repeat into an unread entry SHALL NOT send another push or email.

#### Scenario: Muted availability
- **WHEN** B has muted `availability` and A creates an overlap with B
- **THEN** B gets the inbox entry but no push or email

#### Scenario: Repeat while unread
- **WHEN** A marks another overlapping day before B has read the first entry
- **THEN** B's existing entry lists both days and B receives no second push

### Requirement: Availability entries end with the friendship
When a friendship ends, the system SHALL delete each side's availability entries caused by the other.

#### Scenario: Unfriend
- **WHEN** A and B unfriend while B holds an availability entry naming A
- **THEN** that entry is deleted
