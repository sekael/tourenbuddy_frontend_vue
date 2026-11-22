## ADDED Requirements

### Requirement: Acceptance is recorded on the server
Accepting the terms SHALL record the user, the account's email address, the version in force and the server's time. A client SHALL NOT write or change an acceptance record directly, SHALL NOT record a version other than the one in force, and SHALL read only its own records.

#### Scenario: Accepting
- **WHEN** a signed-in user accepts the version in force
- **THEN** a record with their id, email, that version and the server time exists, and their status shows that version as accepted

#### Scenario: Wrong version
- **WHEN** a client asks to accept a version that is not in force
- **THEN** nothing is recorded and the request fails with `terms_version_mismatch`

### Requirement: Writes need the current acceptance once enforced
With enforcement on, every client write to the app's data (tables and the GPX and attachment buckets) SHALL be refused with `terms_not_accepted` unless the user has accepted the version in force. Reading, deleting the account, signing in and out, and accepting SHALL never be refused for it. Server-side writes (service role, scheduled jobs) SHALL not be affected.

#### Scenario: Not accepted
- **WHEN** enforcement is on and a user who has not accepted the version in force saves a tour
- **THEN** the save is refused with `terms_not_accepted` and nothing is written

#### Scenario: Enforcement off
- **WHEN** enforcement is off and the same user saves a tour
- **THEN** the tour is saved

### Requirement: The record outlives the account for 10 years
Deleting an account by any path SHALL keep its acceptance records for 10 years from the deletion, then remove them.

#### Scenario: Account deleted
- **WHEN** an account is deleted
- **THEN** its acceptance records remain, marked to be removed 10 years after the deletion

### Requirement: The PWA asks for acceptance before use
The PWA SHALL show the acceptance page, with the same wording, states and actions as the native apps, before any page of the app, before onboarding and before subscribing to push.

#### Scenario: Signing in to the PWA
- **WHEN** a user who has not accepted the version in force signs in to the PWA
- **THEN** the acceptance page shows, and the map opens only after they accept
