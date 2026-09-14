## ADDED Requirements

### Requirement: A completed write is never overwritten by a slower read

A successfully completed attachment write (add, delete, reorder) SHALL take precedence over
any list read that was issued before that write completed. A read result that becomes stale
while in flight SHALL be discarded rather than applied to the loaded list. Discarding a read
SHALL NOT discard a cached snapshot already painted for a cold load.

#### Scenario: List read resolves after an upload it could not see

- **WHEN** a list read is in flight
- **AND** an attachment upload and row insert complete before that read resolves
- **THEN** the read result SHALL be discarded
- **AND** the loaded list SHALL still contain the newly inserted attachment

#### Scenario: List read resolves after a deletion it could not see

- **WHEN** a list read is in flight
- **AND** the user deletes an attachment before that read resolves
- **THEN** the deleted attachment SHALL NOT reappear in the loaded list

#### Scenario: Uncontended read applies normally

- **WHEN** a list read completes with no attachment write having occurred while it was in flight
- **THEN** the result SHALL be applied to the loaded list

### Requirement: Attachment bytes are read cache-first

Reading an attachment's bytes SHALL serve locally cached bytes when present, without issuing
any network request. A cache miss SHALL fetch through a signed URL and cache the result, as
today.

This is sound because an attachment's storage path is owned by exactly one attachment: each
picked file mints a new `attachment_uuid` path, and the only write that may target an existing
object is a retry of that same attachment's own upload, which re-sends the identical bytes the
cache already holds. A cache hit therefore cannot be stale. Any change that writes DIFFERENT
bytes to an existing attachment path — an edit-in-place, a path reused across attachments —
SHALL be treated as breaking this requirement.

#### Scenario: A retried upload does not invalidate the cached bytes

- **WHEN** an attachment upload is retried after a failure and overwrites the object it had already partially written
- **THEN** the bytes sent SHALL be the same cached bytes the picker is rendering
- **AND** the cache-first read SHALL continue to serve them without a network request

The cache-first behaviour SHALL be opt-in per call site and SHALL NOT apply to GPX tracks,
whose storage key is upserted on replace.

#### Scenario: Re-opening a tour costs no bandwidth

- **WHEN** the user opens a tour whose attachment bytes are already cached
- **THEN** the attachments SHALL render from the cache
- **AND** no signed-URL request and no byte download SHALL be issued

#### Scenario: Flaky connection does not stall rendering

- **WHEN** the device is nominally online but the connection is failing
- **AND** the attachment's bytes are cached
- **THEN** rendering SHALL NOT wait on a network attempt before using the cached bytes

#### Scenario: Never-viewed attachment while offline

- **WHEN** an attachment's bytes have never been cached and the device is offline
- **THEN** the existing "unavailable offline" fallback SHALL be shown

### Requirement: Per-file upload progress, cancellation and retry

While attachment uploads are running the system SHALL show, per file, its filename, a
determinate progress indicator reflecting bytes transferred, and a Cancel control. Files SHALL
upload and settle independently: one file's failure or cancellation SHALL NOT abort the others.

Cancelling SHALL abort that file's transfer, leave no attachment row, best-effort remove any
storage object and locally cached bytes for it, and surface no error message. No other unsaved
form input SHALL be discarded and already-persisted attachments SHALL remain.

A file whose upload fails SHALL keep its row in a failed state offering Retry and Dismiss.
Retry SHALL re-upload from the locally cached bytes without requiring the user to pick the file
again. Dismiss SHALL evict those bytes and remove the row. While the device is offline, Retry
SHALL be disabled rather than queued — attachment upload remains online-only.

#### Scenario: Progress reflects transfer

- **WHEN** a 6 MB image is uploading
- **THEN** the progress indicator SHALL advance as bytes are transferred rather than showing an indeterminate spinner

#### Scenario: Cancel one of several uploads

- **WHEN** three files are uploading and the user cancels the second
- **THEN** the second file's transfer SHALL be aborted and produce no attachment row
- **AND** the first and third SHALL continue and complete

#### Scenario: Cancel does not discard tour edits

- **WHEN** the user has edited the tour name and cancels an in-flight upload
- **THEN** the edited tour name SHALL be retained in the form
- **AND** previously completed attachment uploads SHALL remain attached to the tour

#### Scenario: One file fails, the rest succeed

- **WHEN** one file of a four-file batch fails to upload
- **THEN** the other three SHALL be persisted
- **AND** the failed file SHALL remain listed in a failed state with Retry and Dismiss

#### Scenario: Retry after a failure

- **WHEN** the user retries a failed upload
- **THEN** the upload SHALL resume from the locally cached bytes with no file re-selection

#### Scenario: Retry is idempotent

- **WHEN** a first attempt wrote the storage object, or inserted the row, before failing
- **THEN** the retry SHALL overwrite that object and reconcile that row rather than failing on an already-exists or duplicate-key error
- **AND** the attachment SHALL appear exactly once in the list, never twice

#### Scenario: Connection lost mid-upload

- **WHEN** the device goes offline while a file is uploading
- **THEN** that file SHALL enter the failed state with Retry disabled
- **AND** Retry SHALL become available again once the device is back online
- **AND** the upload SHALL NOT be enqueued for automatic replay

#### Scenario: Sheet closed during upload

- **WHEN** the user closes the form while an attachment upload is running
- **THEN** the upload SHALL continue to completion and its attachment row SHALL be inserted

### Requirement: Save is blocked while attachment uploads are in flight

The tour form's Save action SHALL be disabled while any attachment upload for that form is in
flight, and SHALL become enabled again once every upload has completed, been cancelled, or
entered the failed state. The guard SHALL also be enforced in the submit handler, so a Save
control rendered outside the form element cannot bypass it.

A failed upload SHALL NOT block Save, so a hard failure cannot dead-end the form.

A Save control that is blocked SHALL be presented as unavailable, not merely inert on
activation — every Save control for the form, including one rendered outside the form element,
SHALL reflect that state.

#### Scenario: A blocked Save looks blocked

- **WHEN** an attachment upload is in flight
- **THEN** every Save control for that form SHALL appear disabled rather than accepting a tap that silently does nothing

### Requirement: Attachment deletion is unavailable offline

Attachments are online-only: deleting one offline can remove neither the row nor the storage
object. The delete control SHALL therefore be absent while the device is offline, rather than
present and failing on activation. An inline delete confirmation SHALL likewise be withdrawn if
the connection is lost while it is open. Reading already-cached attachments SHALL be unaffected.

#### Scenario: Delete control while offline

- **WHEN** a user opens a tour's attachments while offline
- **THEN** no delete control SHALL be offered for any attachment
- **AND** the attachments SHALL still render from cached bytes

#### Scenario: Connection lost during a delete confirmation

- **WHEN** the device goes offline while a delete confirmation is showing
- **THEN** the confirmation SHALL be withdrawn rather than offering a delete that cannot run

#### Scenario: Save disabled during upload

- **WHEN** an attachment upload is in flight
- **THEN** the Save button SHALL be disabled

#### Scenario: Cancelling the last upload re-enables Save

- **WHEN** the only in-flight upload is hanging on a slow connection
- **AND** the user cancels it
- **THEN** Save SHALL be enabled immediately
- **AND** submitting SHALL persist the tour's other changes and its already-uploaded attachments

#### Scenario: Failed upload leaves the form savable

- **WHEN** an upload has failed and is showing Retry
- **THEN** Save SHALL be enabled

#### Scenario: External Save control during upload

- **WHEN** an attachment upload is in flight
- **AND** the submit handler is invoked from a Save control outside the `<form>`
- **THEN** the submission SHALL be ignored

### Requirement: Picked files render from local bytes

An attachment's storage path SHALL be minted client-side before its upload begins, and the
picked bytes SHALL be written to the local blob cache under that path. Rendering the attachment
SHALL then serve those local bytes, without requesting a signed URL or downloading the file.

#### Scenario: Thumbnail visible before upload completes

- **WHEN** the user picks an image on a slow connection
- **THEN** its thumbnail SHALL render from the locally cached bytes while the upload is still running

#### Scenario: No download after upload

- **WHEN** an upload has just completed
- **THEN** displaying that attachment SHALL NOT issue a signed-URL request or download its bytes

#### Scenario: Cancelled upload leaves no cached bytes

- **WHEN** an upload is cancelled or dismissed after failing
- **THEN** the locally cached bytes for its storage path SHALL be evicted

### Requirement: Filenames are de-duplicated with numbering

When a picked file's name is already taken by an attachment the tour holds, has staged, or is
uploading, the stored `original_filename` SHALL be made unique by appending an incrementing
number to the base name, preserving the extension. A name that does not collide SHALL be kept
unchanged. The name shown while uploading SHALL be the name that is persisted.

#### Scenario: Repeated camera captures

- **WHEN** the user takes three photos in succession and the device names each one `image.jpg`
- **THEN** the stored filenames SHALL be `image.jpg`, `image1.jpg`, and `image2.jpg`

#### Scenario: Collision against an already-persisted attachment

- **WHEN** the tour already holds `image.jpg` and the user picks another file named `image.jpg`
- **THEN** the new attachment SHALL be stored as `image1.jpg`

#### Scenario: Distinct names preserved

- **WHEN** the user picks `Hoernli-summit.jpg` from the photo library
- **THEN** the stored filename SHALL be `Hoernli-summit.jpg` unchanged

## MODIFIED Requirements

### Requirement: Attachment count limit per tour

A tour SHALL hold at most 5 attachments, enforced client-side at selection and by a database
`BEFORE INSERT` trigger as the backstop. The client-side count SHALL include attachments that
are currently uploading, so a second selection made while a batch is still in flight cannot
exceed the cap.

A cap rejection SHALL always be reported from freshly read data: when either the client check
or the database trigger rejects an insert, the system SHALL refetch the tour's attachments and
render a localized message stating the remaining capacity derived from that refreshed count.

Raw database error text SHALL NEVER be shown to the user. A repository failure that is not a
cap violation SHALL surface a localized generic upload-failure message, with the underlying
error logged only.

#### Scenario: Sixth attachment rejected client-side

- **WHEN** the tour already holds 5 attachments
- **THEN** the picker's add control SHALL be replaced by a limit-reached message and no upload SHALL start

#### Scenario: Second selection while a batch is uploading

- **WHEN** three files are uploading for a tour that holds none
- **AND** the user selects three more files
- **THEN** the selection SHALL be rejected against the cap before any upload starts

#### Scenario: Database trigger rejects the insert

- **WHEN** an insert is rejected by the `tour_attachment_limit_exceeded` trigger
- **THEN** the tour's attachments SHALL be refetched
- **AND** the message shown SHALL be the localized remaining-capacity message computed from the refetched list
- **AND** the trigger's exception text SHALL NOT appear in the UI

#### Scenario: Non-cap upload failure

- **WHEN** a storage upload fails with a network or permission error
- **THEN** a localized generic upload-failure message SHALL be shown
- **AND** the underlying error message SHALL be written to the log only

### Requirement: Create-flow staging

During tour creation the user SHALL be able to select attachments before the tour row exists.
Selected files SHALL be uploaded immediately to a client-minted storage path under a pre-minted
tour id, mirroring the GPX pre-upload flow, and the form's Save SHALL be blocked until those
uploads settle. Attachment ROWS SHALL be inserted only AFTER the parent `tours` row is
successfully inserted.

If the tour insert fails, or the user cancels the form, no attachment rows SHALL exist and any
pre-uploaded storage objects SHALL be removed best-effort together with their cached bytes.

#### Scenario: Successful create with attachments

- **WHEN** the user picks 3 valid files during tour create and submits the form
- **THEN** the 3 files SHALL already be uploaded at submit time
- **AND** the tour row SHALL be inserted first, then 3 attachment rows referencing the new `tour_id`

#### Scenario: Save blocked during create-flow pre-upload

- **WHEN** a picked file is still uploading in the create form
- **THEN** Save SHALL be disabled until it completes, is cancelled, or fails

#### Scenario: User cancels create with files pre-uploaded

- **WHEN** the user has pre-uploaded files in the create form and closes it without submitting
- **THEN** no attachment rows SHALL exist for that aborted draft
- **AND** the pre-uploaded storage objects SHALL be removed best-effort

### Requirement: Add attachment workflow

Adding an attachment SHALL upload the file to storage at path
`<owner_id>/<tour_id>/<attachment_uuid>.<ext>` first, then insert a `tour_attachments` row. If
the row insert fails, the system SHALL best-effort delete the orphan storage object.

The `attachment_uuid` — and therefore the full storage path — SHALL be generated by the client
before the upload starts, so the path is known while the transfer is in flight. Every attachment
upload path (edit flow, create flow, and suggestion staging) SHALL use a single transport that
reports transferred bytes and can be aborted.

#### Scenario: Successful upload

- **WHEN** an allowed file is selected and the tour has fewer than 5 existing attachments
- **THEN** the file SHALL be uploaded and a corresponding `tour_attachments` row SHALL be inserted with `sort_order` placing it at the end of the list
- **AND** the inserted row's id SHALL be the id minted before the upload

#### Scenario: Row insert failure cleanup

- **WHEN** the storage upload succeeds but the row insert fails
- **THEN** the system SHALL attempt to delete the uploaded storage object
