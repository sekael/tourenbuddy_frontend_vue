## MODIFIED Requirements

### Requirement: GPX and attachment file access for partner friends
GPX track files **and tour attachments** SHALL be readable by a partner-friend of the owner when the tour is `friends`-visible, and SHALL remain blocked for non-partner friends and for private tours. Access SHALL be enforced at the storage layer (not only by gating the path in the read view); attachment **metadata rows** (`tour_attachments`) SHALL likewise be readable by partner-friends while writes stay owner-only.

Owner-only write isolation SHALL be preserved when a partner suggests a file: the partner writes only into their **own** uid prefix, and the tour owner gains SELECT solely on objects referenced by a suggestion on their own tour. No policy SHALL grant any user write access to another user's prefix.

#### Scenario: Partner friend downloads the GPX
- **WHEN** a partner-friend requests the GPX object of a friends-visible tour they are a partner on
- **THEN** the storage policy permits the download

#### Scenario: Partner friend reads attachments
- **WHEN** a partner-friend opens a friends-visible tour they are a partner on
- **THEN** the `tour_attachments` rows and their storage objects are readable, so attachments render

#### Scenario: Non-partner friend blocked from GPX and attachments
- **WHEN** a non-partner friend requests the GPX object or attachment rows/objects of a friends-visible tour
- **THEN** the storage policy and table RLS deny access

#### Scenario: Private tour files blocked
- **WHEN** any non-owner requests the GPX object or attachments of a private tour
- **THEN** the storage policy and table RLS deny access

#### Scenario: Partner cannot write into the owner's prefix
- **WHEN** a marked partner attempts to upload directly into the tour owner's storage prefix
- **THEN** the storage policy denies the write, and staging under the partner's own prefix remains the only path

## ADDED Requirements

### Requirement: Partner status gates the right to suggest

Marked-partner status, already the gate for reading a tour's detail, SHALL additionally
gate the right to create suggestions on that tour. The predicate SHALL be re-evaluated on
every suggestion mutation, and its loss SHALL void pending suggestions.

#### Scenario: Losing partner status revokes suggesting
- **WHEN** the contact linking a partner to a tour loses its matching phone
- **THEN** that user can no longer create suggestions on the tour and their pending suggestions are voided

#### Scenario: Friendship removal voids pending suggestions
- **WHEN** the friendship between the owner and a suggesting partner is removed
- **THEN** the partner's pending suggestions move to `withdrawn` and no longer appear in the owner's review sheet

#### Scenario: Tour going private voids pending suggestions
- **WHEN** the owner switches a tour with pending suggestions to `private`
- **THEN** those suggestions move to `withdrawn`
