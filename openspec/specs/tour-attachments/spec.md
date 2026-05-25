## Purpose

Attach images and PDFs to tours, stored in Supabase Storage with signed-URL retrieval and per-tour access control.

## Requirements

### Requirement: Per-tour attachment storage

The system SHALL persist file attachments associated with a tour in a dedicated `tour_attachments` table and a private Supabase Storage bucket `tour-attachments`. Attachment rows SHALL be readable, writable, and deletable only by the owning user via RLS.

#### Scenario: Owner reads own attachments

- **WHEN** an authenticated user queries attachments for a tour they own
- **THEN** the rows for that tour SHALL be returned

#### Scenario: Non-owner cannot read attachments

- **WHEN** an authenticated user queries attachments for a tour owned by another user
- **THEN** the query SHALL return zero rows

#### Scenario: Non-owner cannot read storage object

- **WHEN** an authenticated user attempts to generate a signed URL for an attachment they do not own
- **THEN** the Storage API SHALL deny the request

### Requirement: Attachment count limit per tour

A tour SHALL hold at most 5 attachments. The limit SHALL be enforced both client-side (selection) and at the database via a `before insert` trigger.

#### Scenario: Sixth upload rejected client-side

- **WHEN** a tour already has 5 attachments and the user selects an additional file
- **THEN** the picker SHALL reject the selection with a user-visible error and SHALL NOT upload

#### Scenario: Sixth insert rejected at DB

- **WHEN** an `insert` is attempted on `tour_attachments` for a tour that already has 5 rows
- **THEN** the insert SHALL fail with a constraint error

### Requirement: Allowed file types and size

Attachments SHALL be restricted to MIME types `image/png`, `image/jpeg`, and `application/pdf`, with file size at most 10 MB (10,485,760 bytes). The constraints SHALL be enforced client-side at selection and at the database via CHECK constraints. HEIC files SHALL be rejected with a dedicated, user-visible error explaining the format is unsupported.

#### Scenario: Disallowed mime rejected

- **WHEN** the user selects a file with mime type `image/gif`
- **THEN** the picker SHALL reject the file with a user-visible error

#### Scenario: HEIC rejected with dedicated message

- **WHEN** the user selects a file with mime type `image/heic` or `image/heif`
- **THEN** the picker SHALL reject the file AND the error message SHALL specifically name HEIC and guide the user to share as JPEG

#### Scenario: Oversize file rejected

- **WHEN** the user selects a file larger than 10 MB
- **THEN** the picker SHALL reject the file with a user-visible error

#### Scenario: Allowed file accepted

- **WHEN** the user selects a 4 MB `image/jpeg` file
- **THEN** the file SHALL upload successfully

### Requirement: Multi-file selection with batch cap enforcement

The file picker SHALL allow selecting multiple files in a single OS picker invocation (`<input multiple>`). When a selection batch would push the total above 5 attachments for the tour, the ENTIRE batch SHALL be rejected with an error stating the remaining capacity.

#### Scenario: Batch fits

- **WHEN** the tour has 2 attachments and the user selects 3 valid files in one batch
- **THEN** all 3 SHALL be queued for upload

#### Scenario: Batch exceeds remaining cap

- **WHEN** the tour has 3 attachments and the user selects 4 files in one batch
- **THEN** zero files SHALL be queued AND the error SHALL state that only 2 more files may be added

### Requirement: EXIF metadata retained

The system SHALL NOT strip EXIF metadata from uploaded images. The bytes uploaded equal the bytes stored.

#### Scenario: EXIF preserved

- **WHEN** the user uploads a JPEG containing GPS EXIF
- **THEN** the stored object SHALL retain the GPS EXIF tags unchanged

### Requirement: Create-flow staging

During tour creation, the user SHALL be able to select attachments before the tour row exists. Selected files SHALL be staged in memory and uploaded only AFTER the parent `tours` row is successfully inserted. If the tour insert fails or is canceled, no storage objects and no attachment rows SHALL be created.

#### Scenario: Successful create with attachments

- **WHEN** the user picks 3 valid files during tour create and submits the form
- **THEN** the tour row SHALL be inserted first, then the 3 files uploaded and 3 attachment rows inserted referencing the new `tour_id`

#### Scenario: User cancels create with files staged

- **WHEN** the user has staged files in the create form and closes the form without submitting
- **THEN** no storage objects and no attachment rows SHALL exist for that aborted draft

### Requirement: Add attachment workflow

Adding an attachment SHALL upload the file to storage at path `<owner_id>/<tour_id>/<attachment_uuid>.<ext>` first, then insert a `tour_attachments` row. If the row insert fails, the system SHALL best-effort delete the orphan storage object.

#### Scenario: Successful upload

- **WHEN** an allowed file is selected and the tour has fewer than 5 existing attachments
- **THEN** the file SHALL be uploaded and a corresponding `tour_attachments` row SHALL be inserted with `sort_order` placing it at the end of the list

#### Scenario: Row insert failure cleanup

- **WHEN** the storage upload succeeds but the row insert fails
- **THEN** the system SHALL attempt to delete the uploaded storage object

### Requirement: Delete attachment

The user SHALL be able to delete any of their attachments. Deletion SHALL be hard (no soft-delete) and require an explicit confirm dialog. Deletion SHALL remove both the database row and the storage object.

#### Scenario: User confirms deletion

- **WHEN** the user taps delete and confirms in the dialog
- **THEN** the `tour_attachments` row SHALL be deleted AND the corresponding storage object SHALL be removed

#### Scenario: User cancels deletion

- **WHEN** the user taps delete and cancels in the dialog
- **THEN** no row and no storage object SHALL be removed

#### Scenario: Tour deletion cascades

- **WHEN** the parent tour is deleted
- **THEN** all `tour_attachments` rows for that tour SHALL be removed via FK cascade

### Requirement: Reorder attachments

The user SHALL be able to reorder attachments. The new order SHALL be persisted atomically via a single RPC `update_attachment_order(tour_id uuid, ordered_ids uuid[])`.

#### Scenario: Reorder via drag

- **WHEN** the user moves attachment B above attachment A
- **THEN** the RPC SHALL be invoked with the new ordered id list AND the persisted `sort_order` values SHALL reflect the new order

#### Scenario: Reorder is atomic

- **WHEN** the RPC fails partway
- **THEN** no `sort_order` change SHALL be visible (transactional)

### Requirement: Signed URL access for download and view

The system SHALL grant read access to an attachment only via short-lived signed URLs (TTL ≤ 5 minutes). View URLs and download URLs SHALL be generated separately, with the download URL setting a `content-disposition: attachment` hint using the `original_filename`.

#### Scenario: View URL generation

- **WHEN** the viewer activates a given attachment
- **THEN** a signed URL with TTL ≤ 5 minutes SHALL be generated and used to load the asset

#### Scenario: Download

- **WHEN** the user taps download on an attachment
- **THEN** a separate signed URL SHALL be generated with download disposition AND the browser SHALL save the file using `original_filename`

#### Scenario: Expired URL recovery

- **WHEN** an in-progress view fails to load due to expired/403 signed URL
- **THEN** the viewer SHALL regenerate a fresh signed URL and retry once

### Requirement: Full-screen viewer with horizontal flip

The system SHALL provide a full-screen viewer that displays the selected attachment and SHALL allow the user to flip between all attachments of the tour via horizontal swipe and on-screen left/right controls. Images SHALL be rendered with a native `<img>`; PDFs SHALL be rendered using `pdfjs-dist` with page-by-page navigation. The viewer's top chrome (filename, download button, close button) SHALL clear the device status bar in standalone PWA mode on both iOS and Android by honoring `env(safe-area-inset-top)`. The viewer's bottom chrome (dots indicator, PDF page navigation) SHALL clear the home indicator / gesture navigation bar by honoring `env(safe-area-inset-bottom)`. Side navigation controls SHALL honor `env(safe-area-inset-left)` / `env(safe-area-inset-right)`. The viewer SHALL also close on a downward swipe gesture past a distance threshold; gesture classification SHALL choose the dominant axis so a clearly horizontal swipe still navigates between attachments, and an upward swipe SHALL NOT close the viewer.

#### Scenario: Flip between files

- **WHEN** the viewer is open on attachment 1 of N
- **THEN** the user SHALL be able to swipe horizontally or press a control to move to attachment 2, and the new attachment SHALL render full-screen

#### Scenario: Image rendering

- **WHEN** the active attachment is an image
- **THEN** it SHALL be rendered using `<img>` fitted to the viewport

#### Scenario: PDF rendering

- **WHEN** the active attachment is a PDF
- **THEN** the viewer SHALL render it using `pdfjs-dist` and SHALL provide page navigation when the PDF has more than one page

#### Scenario: PDF dependency loaded lazily

- **WHEN** a tour view renders without opening the viewer for a PDF
- **THEN** `pdfjs-dist` SHALL NOT be loaded into the main bundle

#### Scenario: Close button clears status bar on iOS and Android PWA

- **WHEN** the viewer is opened in a standalone PWA on iOS or Android where `env(safe-area-inset-top)` is non-zero
- **THEN** the header (including the close button) SHALL be offset by at least the safe-area top inset so the close button is fully tappable and not occluded by the system status bar

#### Scenario: Bottom chrome clears home indicator / gesture bar

- **WHEN** the viewer is opened on a device where `env(safe-area-inset-bottom)` is non-zero
- **THEN** the dots indicator (and PDF page navigation, when shown) SHALL be offset by at least the safe-area bottom inset

#### Scenario: Swipe down closes viewer

- **WHEN** the user performs a touch gesture whose downward vertical displacement (`dy > 0`) exceeds the close threshold AND exceeds the absolute horizontal displacement
- **THEN** the viewer SHALL emit `close` and be dismissed

#### Scenario: Swipe up does not close

- **WHEN** the user performs a touch gesture whose upward vertical displacement (`dy < 0`) exceeds the close threshold
- **THEN** the viewer SHALL NOT close

#### Scenario: Horizontal swipe still navigates

- **WHEN** the user performs a touch gesture whose absolute horizontal displacement exceeds the navigation threshold AND exceeds the absolute vertical displacement
- **THEN** the viewer SHALL navigate to the previous or next attachment and SHALL NOT close

### Requirement: Attachments excluded from PWA runtime cache

The PWA runtime cache SHALL NOT cache responses from the `tour-attachments` storage path/origin, to avoid serving expired or stale signed URLs.

#### Scenario: Service worker bypass

- **WHEN** the service worker intercepts a fetch for a `tour-attachments` signed URL
- **THEN** the response SHALL bypass the runtime cache (network-only)

### Requirement: Tour attachments list reacts to Realtime changes

When the user has a tour-attachments view open and an attachment for that tour is inserted, updated, or deleted on another device, the local view SHALL reflect the change within one debounce window without a manual reload.

The subscription MAY be served by the same per-user Realtime channel that the tours store uses (binding for `tour_attachments` filtered by `user_id=eq.${uid}`), with the attachments store reacting to the same `onChange` debounced trigger via a refetch of the currently displayed tour's attachments.

#### Scenario: New attachment on device A appears on device B
- **WHEN** device A uploads an attachment for tour T and device B has tour T's attachment view open
- **THEN** the attachment appears on device B without a manual reload

#### Scenario: Attachment deletion on device A removes it on device B
- **WHEN** device A deletes an attachment for tour T
- **THEN** device B removes it from its open view of tour T

#### Scenario: Attachments for other tours don't trigger refetch
- **WHEN** an event arrives for an attachment whose `tour_id` is not the currently viewed tour
- **THEN** the attachments store does not perform a per-tour refetch (cost-bounded)
