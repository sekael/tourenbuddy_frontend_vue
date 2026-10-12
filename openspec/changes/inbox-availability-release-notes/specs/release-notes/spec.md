# Spec Delta

## Purpose
Announce new features to existing users inside the app, once per user, at the moment they actually run the build that contains them.

## ADDED Requirements

### Requirement: Release notes ship with the app
Release notes SHALL be part of the app bundle, each identified by the app version it belongs to and carrying its release date and localized (`en`, `de-CH`) title and body. Not every version needs a note.

#### Scenario: Version without a note
- **WHEN** the user runs a build whose version has no note and no newer note exists
- **THEN** no release-note entry is recorded

### Requirement: One entry per note per user
When a signed-in user runs a build, the app SHALL record an inbox entry for the newest note whose version is not newer than the running build, unless that note was already recorded for the user. A note SHALL be recorded at most once per user — across devices, reloads, and after the entry is deleted. Recording requires a connection and SHALL be retried on the next online start when it fails.

#### Scenario: First run of a new build
- **WHEN** an existing user opens the app on a build that carries a new note
- **THEN** one unread release-note entry appears in their inbox

#### Scenario: Second device
- **WHEN** the same user opens the new build on a second device
- **THEN** no second entry is recorded

#### Scenario: Deleted entry stays deleted
- **WHEN** the user deletes the release-note entry and reloads the app
- **THEN** the entry is not recorded again

#### Scenario: Offline start
- **WHEN** the new build first starts offline
- **THEN** no entry is recorded until the next online start

### Requirement: Release-note eligibility
Users whose account was created after a note's release date SHALL NOT receive it. Only the newest note is recorded; intermediate notes the user skipped SHALL NOT be backfilled.

#### Scenario: New account
- **WHEN** a user who signed up after the note's release date opens the app
- **THEN** no entry is recorded for that note

#### Scenario: Skipped versions
- **WHEN** a user jumps from a build before note 1 straight to a build carrying note 2
- **THEN** only note 2 is recorded

### Requirement: Release notes are inbox-only
Release-note entries SHALL NOT be sent by push or email and SHALL NOT appear as a mutable type in notification preferences. They SHALL have no actor.

#### Scenario: No push
- **WHEN** a release-note entry is recorded
- **THEN** no push or email is sent

### Requirement: Reading a release note
Activating a release-note entry SHALL mark it read and show the note's localized title and body in the current app locale. A release-note entry SHALL never be stale. If the running build no longer contains the note, the app SHALL show the "no longer available" message.

#### Scenario: Open note
- **WHEN** the user taps a release-note entry
- **THEN** the entry becomes read and the note is shown
