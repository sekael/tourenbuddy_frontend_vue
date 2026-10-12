# Spec Delta

## MODIFIED Requirements

### Requirement: Inbox event coverage
The inbox SHALL record the same event set that push/email notify about: friend request received and responded; shared tour created (incl. newly-added partner), meaningfully updated, deleted; same-tour collision detected; friendship-accept backfill digest; link request created, accepted, declined; group member joined, evicted, dissolved; suggestion batch submitted and fully resolved; a friend's availability overlapping the recipient's. The inbox SHALL additionally hold release-note entries, which have no push/email counterpart. Recipient rules SHALL match the corresponding push/email requirements.

#### Scenario: Suggestion batch recorded once
- **WHEN** a partner submits four field suggestions in one batch
- **THEN** the owner has exactly one inbox entry for the batch

#### Scenario: Non-meaningful edit not recorded
- **WHEN** the owner only changes the notes of a shared tour
- **THEN** no partner gets an inbox entry

#### Scenario: Withdrawal not recorded
- **WHEN** an initiator withdraws a pending link request
- **THEN** no inbox entry is created

#### Scenario: Availability overlap recorded
- **WHEN** a friend's newly available day overlaps the user's available day
- **THEN** the user has an availability entry naming the friend

#### Scenario: Release note recorded
- **WHEN** the user first runs a build carrying a release note
- **THEN** the user has one release-note entry

### Requirement: Repeated unread events collapse
For shared-tour edits, same-tour collision events and availability overlaps, when the recipient already has an unread entry with the same type, action, tour and actor, the system SHALL update that entry (move it to the top, increment its occurrence count) instead of creating a new one. For availability overlaps (which have no tour) the match is on type, action and actor, and the collapsed entry SHALL list the union of overlapping days. A collapsed occurrence SHALL NOT send push or email. Once the entry is read, the next occurrence SHALL create a new entry.

#### Scenario: Burst of edits
- **WHEN** A edits a shared tour five times before B opens the inbox
- **THEN** B has one unread "updated" entry showing 5 changes and received at most one push

#### Scenario: After reading
- **WHEN** B reads that entry and A edits the tour again
- **THEN** B gets a new unread entry and a push

#### Scenario: Different actor
- **WHEN** A and C each edit the same shared tour
- **THEN** B has two separate entries

#### Scenario: Availability repeat merges days
- **WHEN** friend A creates an overlap on Monday and, before B reads it, another on Friday
- **THEN** B has one unread availability entry listing Monday and Friday

### Requirement: Opening an entry deep-links and marks it read
Activating an entry SHALL mark it read and navigate to its subject: the tour info sheet for tour, suggestion, interest and link events; the friend requests sheet for friend-request events; the backfill collisions list for digests; the calendar focused on the earliest overlapping day that is not in the past for availability entries; the note itself for release-note entries. Entries SHALL NOT offer inline actions (accept, decline, review); acting happens on the target surface. If the subject no longer exists the entry SHALL still be marked read and the app SHALL show a "no longer available" message instead of navigating.

An entry SHALL open a tour only if the user may access it at the moment of activation: a tour they own, or a friend tour they are currently a partner on. A tour the user was removed from, or that went private, SHALL be treated as no longer available — even though the entry once named it. Access SHALL be decided against a fresh server read when online, never solely against cached data. A collision entry SHALL open the recipient's own colliding tour, not the other user's. The stale chip SHALL apply the same rule.

When a user loses access to a tour — removed as partner, the tour made private or deleted, or the friendship with its owner ended — the database SHALL delete the entries that user holds about that tour (a `deleted` notice is kept). Regaining access SHALL NOT restore them: the inbox continues from the next event, and a tour shared again SHALL notify its partners as newly shared.

The user SHALL be able to clear the inbox: after an inline confirmation, every entry they have seen is deleted (entries arriving later stay). Clearing SHALL work offline and sync on reconnect.

#### Scenario: Open a shared-tour entry
- **WHEN** the user taps an unread "tour updated" entry
- **THEN** the entry becomes read and the tour's info sheet opens

#### Scenario: Subject gone
- **WHEN** the user taps an entry whose tour was deleted
- **THEN** the entry becomes read and a "no longer available" snackbar is shown

#### Scenario: Removed partner
- **WHEN** a user taps an entry for a tour whose owner has since removed them as partner
- **THEN** the entry becomes read, the tour does not open, and a "no longer available" snackbar is shown

#### Scenario: Tour went private
- **WHEN** a user taps an entry for a friend's tour that has since been made private
- **THEN** the tour does not open, even if a cached copy is still on the device

#### Scenario: Re-shared tour starts over
- **WHEN** a tour the user is a partner on goes private and is later shared with friends again
- **THEN** the entries from before are gone and the user receives one new "shared with you" entry

#### Scenario: Clear inbox
- **WHEN** the user taps "Clear inbox" and confirms
- **THEN** every entry is deleted; tapping "Clear inbox" without confirming deletes nothing

#### Scenario: Opened via push
- **WHEN** the user opens the app by tapping a push notification
- **THEN** the corresponding inbox entry is marked read

#### Scenario: Open an availability entry
- **WHEN** the user taps an availability entry listing 2030-01-04 and 2030-01-09
- **THEN** the entry becomes read and the calendar opens focused on 2030-01-04

#### Scenario: Open a release-note entry
- **WHEN** the user taps a release-note entry
- **THEN** the entry becomes read and the note's title and body are shown

### Requirement: Staleness is derived from live state
An entry SHALL be stale when its subject is no longer actionable or no longer exists: an answered or cancelled friend request; a suggestion batch no longer pending; a link request no longer pending; a referenced tour that no longer exists or is no longer visible. Informational entries (tour updated, group events, digests) SHALL be stale only when their tour no longer exists. An availability entry SHALL be stale once all its days are in the past. A release-note entry SHALL never be stale. Staleness SHALL be computed client-side and SHALL NOT modify the stored entry.

#### Scenario: Request cancelled
- **WHEN** A cancels a friend request B has not opened
- **THEN** B's entry renders stale with a "No longer pending" chip

#### Scenario: Tour deleted
- **WHEN** a tour referenced by an "updated" entry is deleted
- **THEN** the entry renders stale with a "Tour deleted" chip

#### Scenario: Informational entry stays live
- **WHEN** a "tour updated" entry's tour still exists
- **THEN** the entry is not stale regardless of later edits

#### Scenario: Availability days passed
- **WHEN** every day listed in an availability entry is before today
- **THEN** the entry renders stale with a "Past" chip

### Requirement: Users only access their own entries
A user SHALL only be able to read, mark read, and delete their own entries and SHALL NOT be able to create entries, except recording their own release-note entry through the dedicated release-note operation, which only accepts a note and only ever creates an entry for the caller.

#### Scenario: Forged insert
- **WHEN** an authenticated client attempts to insert an inbox entry
- **THEN** the insert is rejected

#### Scenario: Foreign entry
- **WHEN** a client requests another user's entries
- **THEN** none are returned

#### Scenario: Release-note recording is self-only
- **WHEN** a client records a release note
- **THEN** the entry is created for the caller only, with no actor and type `release_notes`
