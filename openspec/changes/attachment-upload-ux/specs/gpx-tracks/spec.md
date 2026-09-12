## MODIFIED Requirements

### Requirement: Responsive upload UX

The system SHALL present GPX upload, replace, and remove controls inside the existing tour
form, adapting layout for mobile (bottom-sheet) and desktop (dialog/drawer) without functional
divergence. In create mode the system SHALL begin uploading the file to Storage immediately
upon successful client-side parse, SHALL show an in-progress indicator while the upload is
running, SHALL block the form's Save button until the upload completes successfully, and SHALL
clean up any uploaded or in-flight object if the user cancels the dialog or replaces the file
before submission.

The in-progress indicator SHALL be determinate, reflecting bytes transferred, whenever the
upload transport reports progress. Where the transport cannot report progress for a given
upload, an indeterminate indicator SHALL remain acceptable.

#### Scenario: Mobile upload

- **WHEN** a mobile user opens the tour create bottom-sheet and taps the GPX upload control
- **THEN** the native file picker opens and after selection the form shows the filename, replace, and remove actions

#### Scenario: Desktop upload

- **WHEN** a desktop user opens the tour edit dialog and uploads a new track
- **THEN** the same controls and states appear, laid out for the wider viewport

#### Scenario: Pre-upload in progress (create mode)

- **WHEN** a user selects a valid `.gpx` file in the create form
- **THEN** the upload to `${userId}/${tourId}.gpx` begins immediately, a progress indicator is shown next to the filename, and the Save button is disabled until the upload resolves

#### Scenario: Progress advances during a slow upload

- **WHEN** a GPX upload is running and the transport reports transferred bytes
- **THEN** the indicator SHALL advance with the transfer rather than showing an indeterminate spinner

#### Scenario: Pre-upload completes before submit

- **WHEN** the pre-upload has resolved successfully
- **THEN** the indicator is removed, the Save button is enabled, and submitting the form inserts the tour with `gpx_filepath = ${userId}/${tourId}.gpx` without re-uploading

#### Scenario: User cancels during in-flight upload

- **WHEN** a user cancels the create dialog while a pre-upload is still running
- **THEN** the in-flight upload is allowed to complete and the resulting object is then deleted (best-effort), and no `tours` row is created

#### Scenario: User replaces the file before submit

- **WHEN** a user picks a new `.gpx` file while a previous pre-upload has already completed
- **THEN** the prior object at `${userId}/${oldTourId}.gpx` is deleted (best-effort), a fresh `tourId` is generated, and the new file is pre-uploaded

#### Scenario: Upload failure with retry

- **WHEN** the Storage upload returns an error
- **THEN** the form shows an i18n error message and offers retry without losing other unsaved form data
