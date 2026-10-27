## MODIFIED Requirements

### Requirement: GPX file storage in Supabase Storage

The system SHALL persist user-uploaded GPX files in a private Supabase Storage bucket named `tour-gpx` under the uploader's prefix, `${userId}/${id}.gpx`, where `userId` is `auth.uid()` of the uploader. `id` SHALL be the tour's UUID (also used as `tours.id`) for a file picked while creating the tour, and a fresh random UUID for every later file — a replacement picked in edit, or an accepted GPX suggestion. The system SHALL store this full key on the `tours` row in column `gpx_filepath`. Each key SHALL be written once: a file is never overwritten in place by another file, so a different track always means a different `gpx_filepath` (an interrupted upload MAY be retried to the same key). The path's first segment encodes the **uploader**, not the readers — read access remains independently controllable so future visibility models (private / shared / public) can be implemented by editing only the SELECT policy, without re-keying objects or migrating existing data.

#### Scenario: Upload during tour creation (pre-upload)

- **WHEN** a user creates a tour and selects a valid `.gpx` file in the form
- **THEN** the client generates `tourId = crypto.randomUUID()`, parses the file client-side, and uploads it to `tour-gpx/${userId}/${tourId}.gpx` immediately, before the tour row is inserted
- **AND** on form submit the same `tourId` is passed to `create_tour_full` and `tours.gpx_filepath` is set to `${userId}/${tourId}.gpx`

#### Scenario: Upload during tour edit (replace)

- **WHEN** a user edits a tour that already has a track and uploads a different `.gpx` file
- **THEN** the new file is uploaded to a fresh key `${userId}/${uuid}.gpx`, saving sets `gpx_filepath` to that key, and the previous object is removed (see Cascade deletion)

#### Scenario: File exceeds size limit

- **WHEN** the selected file is larger than 5 MB
- **THEN** the upload is rejected client-side, an i18n error message is displayed, and no Storage object is created

#### Scenario: File fails to parse

- **WHEN** the selected file cannot be parsed as GPX
- **THEN** the form shows an i18n parse error and no Storage object is created

### Requirement: Lazy fetch and caching of GPX data

The system SHALL fetch and parse a tour's GPX file on demand when the tour is selected on the map, and SHALL keep the most recently parsed tracks in memory, keyed by `gpx_filepath`, to avoid duplicate work. Because a key is written once, a write that leaves `gpx_filepath` unchanged (completion, visibility or any other field) SHALL reuse the parsed track: the map SHALL keep the track drawn throughout, never emptying it while the tour reloads.

#### Scenario: First selection

- **WHEN** a tour with `gpx_filepath` is selected for the first time in a session
- **THEN** the client requests a signed URL, downloads the file, parses it, caches the result, and renders the track

#### Scenario: Re-selection

- **WHEN** the same tour is re-selected later in the session
- **THEN** the cached GeoJSON is reused without re-downloading, and the track colouring is recomputed from the tour's current types before the track is shown, so colour always reflects the latest activity types

#### Scenario: Tour without track

- **WHEN** a tour with `gpx_filepath = null` is selected
- **THEN** the gpx-track layer renders no polyline and no network request is made

#### Scenario: Completion or visibility toggled

- **WHEN** the owner marks the selected tour completed or incomplete, or toggles its visibility, and the refetched row carries a new `updated_at`
- **THEN** the track stays drawn in every frame, and the file is neither downloaded nor parsed again

#### Scenario: Track replaced

- **WHEN** the selected tour's track is replaced
- **THEN** the track is loaded from its new `gpx_filepath`, never served from the old one's parse
