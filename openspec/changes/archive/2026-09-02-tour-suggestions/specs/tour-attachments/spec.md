## ADDED Requirements

### Requirement: Partner staging area for suggested files

A partner suggesting a GPX track or an attachment SHALL upload the file to a staging path
under their **own** uid prefix (`<suggester_uid>/suggestions/<tour_id>/<uuid>`) in the
existing bucket, so that no policy granting a non-owner write access to another user's
prefix is required. The tour owner SHALL be granted SELECT on objects referenced by a
suggestion on their own tour, so the review sheet can render the proposed file. No other
user SHALL gain access to a staged object.

#### Scenario: Partner uploads a staged file
- **WHEN** a marked partner uploads a suggested photo for a friend's tour
- **THEN** the object is written under the partner's own uid prefix and the upload succeeds under the existing owner-insert policy

#### Scenario: Owner reads a staged file for review
- **WHEN** the tour owner opens the review sheet on a suggestion carrying a staged file
- **THEN** a signed URL for the staged object resolves

#### Scenario: Third party cannot read a staged file
- **WHEN** another partner on the same tour requests a signed URL for the staged object
- **THEN** the Storage API denies the request

#### Scenario: Staged file for a resolved suggestion is swept
- **WHEN** the author's client loads suggestions and finds staged objects belonging to their own resolved suggestions
- **THEN** those objects are deleted

### Requirement: Accepted file is copied into the owner's prefix

On accepting a `gpx` or `attachment_add` suggestion, the system SHALL copy the staged
object into the owner's own prefix before recording the change, and the persisted
`gpx_filepath` / `storage_path` SHALL reference the owner's copy. The tour SHALL never
reference an object whose lifetime is controlled by a non-owner.

#### Scenario: Accepted attachment references the owner's copy
- **WHEN** the owner accepts an `attachment_add` suggestion
- **THEN** a copy is created under the owner's prefix and the new `tour_attachments` row references that path

#### Scenario: Author deleting their staged file does not break an accepted attachment
- **WHEN** the author later deletes their staged object
- **THEN** the accepted attachment still resolves, because it references the owner's copy

### Requirement: The cap is enforced while a suggestion is composed

Suggest mode SHALL measure the remaining attachment slots against the tour's END state —
the owner's existing attachments, minus the ones this batch proposes to remove, plus the
files staged so far — rather than against the staged files alone. When no slot remains the
picker SHALL refuse further files and SHALL tell the partner that proposing a removal makes
room. A batch that would still breach the cap SHALL NOT be submittable.

#### Scenario: Partner cannot propose past the cap

- **WHEN** a partner opens suggest mode on a tour already holding four attachments and picks four files
- **THEN** the selection is refused with the remaining count, and only files fitting the cap can be staged

#### Scenario: Proposing a removal frees a slot immediately

- **WHEN** the partner marks one of the owner's attachments for removal on a full tour
- **THEN** the picker offers to add a file again

#### Scenario: Un-marking a removal blocks the submission

- **WHEN** the partner un-marks a removal after staging the file that removal made room for
- **THEN** the form reports that the proposal is over the limit and refuses to submit it

### Requirement: An accepted attachment reaches the author's view without a reload

The suggestion author SHALL see an accepted `attachment_add` appear on the tour without
reloading the page. The attachment row is written under the OWNER's user id, so the author's
own user-scoped attachment subscription never observes it; the author's own suggestion row
changing status SHALL therefore also refresh the open tour's attachments. The attachment
list SHALL likewise be refreshed when a surface that adjudicates or composes against it is
opened, since the list is what its cap decisions are computed from.

#### Scenario: Author sees the accepted photo appear

- **WHEN** the owner accepts a partner's `attachment_add` while that partner has the tour open
- **THEN** the attachment appears in the partner's view without a manual reload

#### Scenario: Returning to a tour resyncs its attachments

- **WHEN** the tour detail view is reopened after an attachment changed while it was closed
- **THEN** the list reflects the change, rather than serving whatever was loaded the first time

## MODIFIED Requirements

### Requirement: Attachment count limit per tour

A tour SHALL hold at most 5 attachments. The limit SHALL be enforced both client-side
(selection) and at the database via a `before insert` trigger.

Accepting an `attachment_add` suggestion that would take the tour past 5 SHALL be rejected
by the accept RPC with the named error `tour_attachment_limit_exceeded` **before** any
write; the suggestion SHALL remain `pending` and the owner SHALL be told to remove an
attachment first.

A batch acceptance SHALL apply its suggestions in a fixed order — attachment removals
first, then scalar fields, then attachment additions — inside one transaction, and the cap
SHALL be evaluated against the resulting **end state**. A batch whose end state holds at
most 5 attachments SHALL therefore succeed even if an intermediate step would have
exceeded the cap. A batch whose end state genuinely breaches the cap SHALL fail as a whole
and resolve nothing.

#### Scenario: Sixth upload rejected client-side

- **WHEN** a tour already has 5 attachments and the user selects an additional file
- **THEN** the picker SHALL reject the selection with a user-visible error and SHALL NOT upload

#### Scenario: Sixth insert rejected at DB

- **WHEN** an `insert` is attempted on `tour_attachments` for a tour that already has 5 rows
- **THEN** the insert SHALL fail with a constraint error

#### Scenario: Accepting a suggested attachment past the cap is blocked

- **WHEN** the owner accepts an `attachment_add` suggestion on a tour that already holds 5 attachments
- **THEN** the RPC raises `tour_attachment_limit_exceeded`, the suggestion stays `pending`, and no attachment row or storage copy is created

#### Scenario: Swap succeeds on a full tour

- **WHEN** the owner accepts a batch containing one `attachment_remove` and one `attachment_add` on a tour already holding 5 attachments
- **THEN** the removal is applied first, the addition succeeds, and the tour holds 5 attachments

#### Scenario: Accept-all breaching the end state resolves nothing

- **WHEN** the owner accepts a batch whose end state would take the tour past 5
- **THEN** the whole batch fails with `tour_attachment_limit_exceeded`, every row stays `pending`, and the tour is unchanged

#### Scenario: Removing an attachment that is already gone

- **WHEN** the owner accepts an `attachment_remove` whose target attachment they had already deleted themselves
- **THEN** the suggestion resolves `accepted` with no further work and no error is raised

#### Scenario: Accept disabled in the UI while the tour is full

- **WHEN** the review sheet renders an `attachment_add` suggestion on a tour holding 5 attachments
- **THEN** the accept action is disabled with a hint to remove an attachment first

#### Scenario: Accept-all disabled when the batch itself would breach the cap

- **WHEN** the batch's end state — current attachments, plus its additions, minus the removals it still carries — would exceed 5
- **THEN** the accept-all action is disabled with a hint, rather than being offered and failing server-side

#### Scenario: A declined removal withdraws the room it was making

- **WHEN** the owner declines the removal that paired with an addition on a full tour
- **THEN** both the row's accept and the batch's accept-all become unavailable, and the hint stops naming accept-all as the way out

#### Scenario: A removal targeting an already-deleted attachment frees nothing

- **WHEN** a batch's removal targets an attachment the owner had already deleted
- **THEN** it is not counted as making room, because accepting it resolves as a no-op
