## MODIFIED Requirements

### Requirement: GPX file storage in Supabase Storage

The system SHALL persist user-uploaded GPX files in a private Supabase Storage bucket named `tour-gpx` using the object key `${userId}/${tourId}.gpx`, where `userId` is `auth.uid()` of the uploader and `tourId` is the UUID also used as `tours.id`. The system SHALL store this full key on the `tours` row in column `gpx_filepath`. The path's first segment encodes the **uploader**, not the readers — read access remains independently controllable so future visibility models (private / shared / public) can be implemented by editing only the SELECT policy, without re-keying objects or migrating existing data.

#### Scenario: Upload during tour creation (pre-upload)

- **WHEN** a user creates a tour and selects a valid `.gpx` file in the form
- **THEN** the client generates `tourId = crypto.randomUUID()`, parses the file client-side, and uploads it to `tour-gpx/${userId}/${tourId}.gpx` immediately, before the tour row is inserted
- **AND** on form submit the same `tourId` is passed to `create_tour_full` and `tours.gpx_filepath` is set to `${userId}/${tourId}.gpx`

#### Scenario: Upload during tour edit (replace)

- **WHEN** a user edits a tour that already has a track and uploads a different `.gpx` file
- **THEN** the new file overwrites the existing object at the canonical key `${userId}/${tourId}.gpx` and `gpx_filepath` remains unchanged

#### Scenario: File exceeds size limit

- **WHEN** the selected file is larger than 5 MB
- **THEN** the upload is rejected client-side, an i18n error message is displayed, and no Storage object is created

#### Scenario: File fails to parse

- **WHEN** the selected file cannot be parsed as GPX
- **THEN** the form shows an i18n parse error and no Storage object is created

### Requirement: Bucket access control

The system SHALL enforce access on `tour-gpx` via RLS policies on `storage.objects` that authorise writes by the path's user prefix and reads by joining the `tours` row identified by the path. INSERT, UPDATE, and DELETE policies SHALL require `(storage.foldername(name))[1] = auth.uid()::text` and SHALL NOT depend on the existence of a `tours` row, so pre-upload during tour creation is permitted. The SELECT policy SHALL authorise the tour's owner today (`auth.uid() = tours.user_id`) using a defensive comparison that does not raise on malformed paths, and MUST be structured so that adding shared-tour and public-tour clauses later requires only an `OR` extension to the SELECT policy — no path or schema migration of existing data.

#### Scenario: Authenticated user uploads under their prefix

- **WHEN** an authenticated user uploads to `tour-gpx/${auth.uid()}/${anyTourId}.gpx`
- **THEN** Supabase Storage accepts the upload regardless of whether a `tours` row with that id exists yet

#### Scenario: User attempts to upload outside their prefix

- **WHEN** an authenticated user attempts to upload to `tour-gpx/${otherUserId}/${tourId}.gpx`
- **THEN** the INSERT policy denies the request

#### Scenario: Owner reads own track

- **WHEN** an authenticated user requests a signed URL for `${userId}/${tourId}.gpx` and owns that tour
- **THEN** Supabase returns a valid time-limited URL

#### Scenario: Non-owner read denied

- **WHEN** an authenticated user requests `${otherUserId}/${tourId}.gpx` for a tour they do not own
- **THEN** Supabase responds with an RLS denial

#### Scenario: Malformed object name does not raise

- **WHEN** an object exists in the bucket whose name does not match the `${uuid}/${uuid}.gpx` pattern
- **THEN** policy evaluation completes without raising and the row is simply not authorised for SELECT

### Requirement: Responsive upload UX

The system SHALL present GPX upload, replace, and remove controls inside the existing tour form, adapting layout for mobile (bottom-sheet) and desktop (dialog/drawer) without functional divergence. In create mode the system SHALL begin uploading the file to Storage immediately upon successful client-side parse, SHALL show an in-progress indicator while the upload is running, SHALL block the form's Save button until the upload completes successfully, and SHALL clean up any uploaded or in-flight object if the user cancels the dialog or replaces the file before submission.

#### Scenario: Mobile upload

- **WHEN** a mobile user opens the tour create bottom-sheet and taps the GPX upload control
- **THEN** the native file picker opens and after selection the form shows the filename, replace, and remove actions

#### Scenario: Desktop upload

- **WHEN** a desktop user opens the tour edit dialog and uploads a new track
- **THEN** the same controls and states appear, laid out for the wider viewport

#### Scenario: Pre-upload in progress (create mode)

- **WHEN** a user selects a valid `.gpx` file in the create form
- **THEN** the upload to `${userId}/${tourId}.gpx` begins immediately, a spinner is shown next to the filename, and the Save button is disabled until the upload resolves

#### Scenario: Pre-upload completes before submit

- **WHEN** the pre-upload has resolved successfully
- **THEN** the spinner is removed, the Save button is enabled, and submitting the form inserts the tour with `gpx_filepath = ${userId}/${tourId}.gpx` without re-uploading

#### Scenario: User cancels during in-flight upload

- **WHEN** a user cancels the create dialog while a pre-upload is still running
- **THEN** the in-flight upload is allowed to complete and the resulting object is then deleted (best-effort), and no `tours` row is created

#### Scenario: User replaces the file before submit

- **WHEN** a user picks a new `.gpx` file while a previous pre-upload has already completed
- **THEN** the prior object at `${userId}/${oldTourId}.gpx` is deleted (best-effort), a fresh `tourId` is generated, and the new file is pre-uploaded

#### Scenario: Upload failure with retry

- **WHEN** the Storage upload returns an error
- **THEN** the form shows an i18n error message and offers retry without losing other unsaved form data
