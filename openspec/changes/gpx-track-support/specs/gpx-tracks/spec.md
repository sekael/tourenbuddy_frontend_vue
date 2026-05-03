## ADDED Requirements

### Requirement: GPX file storage in Supabase Storage
The system SHALL persist user-uploaded GPX files in a private Supabase Storage bucket named `tour-gpx` using the object key `${tourId}.gpx`, and SHALL store that key on the `tours` row in column `gpx_filepath`. The path layout MUST be tour-id-rooted (owner-agnostic) so future visibility models (private / shared / public) can be implemented by changing RLS policies alone, without re-keying objects.

#### Scenario: Upload during tour creation
- **WHEN** a user creates a tour and selects a valid `.gpx` file in the form
- **THEN** the file is parsed client-side, the tour is inserted, the file is uploaded to `tour-gpx/${tourId}.gpx`, and `tours.gpx_filepath` is set to that key

#### Scenario: Upload during tour edit (replace)
- **WHEN** a user edits a tour that already has a track and uploads a different `.gpx` file
- **THEN** the new file overwrites the existing object at the same canonical key and `gpx_filepath` remains unchanged

#### Scenario: File exceeds size limit
- **WHEN** the selected file is larger than 2 MB
- **THEN** the upload is rejected client-side, an i18n error message is displayed, and no Storage object is created

#### Scenario: File fails to parse
- **WHEN** the selected file cannot be parsed as GPX
- **THEN** the form shows an i18n parse error and no Storage object is created

### Requirement: Bucket access control
The system SHALL enforce access on `tour-gpx` via RLS policies that resolve the path to a tour id and authorise based on the `tours` row. In the initial release the only authorised principal is the tour's owner (`auth.uid() = tours.user_id`). The policy MUST be structured so that adding shared-tour and public-tour clauses later requires only a policy update, not a path or schema migration of existing data.

#### Scenario: Owner reads own track
- **WHEN** an authenticated user requests a signed URL for `${tourId}.gpx` and owns that tour
- **THEN** Supabase returns a valid time-limited URL

#### Scenario: Non-owner read denied
- **WHEN** an authenticated user requests `${tourId}.gpx` for a tour they do not own
- **THEN** Supabase responds with an RLS denial

### Requirement: Cascade deletion
The system SHALL delete the GPX Storage object when its associated tour is deleted, when the user explicitly removes the track from the tour, or when the user replaces it via re-upload (overwrite semantics).

#### Scenario: Tour deleted
- **WHEN** a user deletes a tour with `gpx_filepath` set
- **THEN** the corresponding Storage object is removed (client-initiated, with DB trigger as fallback)

#### Scenario: Track removed in edit
- **WHEN** a user clicks the remove-track action and saves the tour
- **THEN** the Storage object is deleted and `gpx_filepath` is set to null

#### Scenario: Orphan cleanup safety net
- **WHEN** a tour row is deleted but the client did not clean up Storage (e.g., crash)
- **THEN** the `AFTER DELETE` trigger on `tours` removes the object using the stored `gpx_filepath`

### Requirement: Track rendering with darker tour-type color
The system SHALL render the selected tour's GPX track on the map as a polyline whose color is a darker variant of `TOUR_TYPE_COLORS[tour.tourType]`, defined by a sibling map `TOUR_TYPE_TRACK_COLORS`. The track color MUST be visually darker than the corresponding tour marker so the marker remains distinguishable when stacked over its track. A defined fallback color SHALL be used when the tour type has no entry.

#### Scenario: Selecting a hiking tour
- **WHEN** a user selects a tour of type `hiking` that has a track
- **THEN** the gpx-track layer renders the polyline using `TOUR_TYPE_TRACK_COLORS.hiking`, which is darker than `TOUR_TYPE_COLORS.hiking`

#### Scenario: Switching selection
- **WHEN** the selected tour changes from a skiing tour to a paragliding tour
- **THEN** the rendered track updates to the paragliding track color without reloading the map style

#### Scenario: Unknown tour type
- **WHEN** a tour has a tour type not present in `TOUR_TYPE_TRACK_COLORS`
- **THEN** the track renders in the defined fallback color

### Requirement: Lazy fetch and caching of GPX data
The system SHALL fetch and parse a tour's GPX file on demand when the tour is selected on the map, and SHALL cache parsed GeoJSON in memory for the session to avoid duplicate work.

#### Scenario: First selection
- **WHEN** a tour with `gpx_filepath` is selected for the first time in a session
- **THEN** the client requests a signed URL, downloads the file, parses it, caches the result, and renders the track

#### Scenario: Re-selection
- **WHEN** the same tour is re-selected later in the session
- **THEN** the cached GeoJSON is reused without re-downloading

#### Scenario: Tour without track
- **WHEN** a tour with `gpx_filepath = null` is selected
- **THEN** the gpx-track layer renders no polyline and no network request is made

### Requirement: Responsive upload UX
The system SHALL present GPX upload, replace, and remove controls inside the existing tour form, adapting layout for mobile (bottom-sheet) and desktop (dialog/drawer) without functional divergence, and SHALL surface upload progress and error states inline.

#### Scenario: Mobile upload
- **WHEN** a mobile user opens the tour create bottom-sheet and taps the GPX upload control
- **THEN** the native file picker opens and after selection the form shows the filename, replace, and remove actions

#### Scenario: Desktop upload
- **WHEN** a desktop user opens the tour edit dialog and uploads a new track
- **THEN** the same controls and states appear, laid out for the wider viewport

#### Scenario: Upload in progress
- **WHEN** the file is being uploaded to Storage
- **THEN** the form indicates progress and prevents duplicate submission

#### Scenario: Upload failure
- **WHEN** the Storage upload returns an error
- **THEN** the form shows an i18n error message and offers retry without losing other unsaved form data

### Requirement: Download original GPX from tour info sheet
The system SHALL expose a download action in the tour info sheet whenever the selected tour has `gpx_filepath` set, allowing the user to download the original `.gpx` file via a signed URL.

#### Scenario: Tour with track
- **WHEN** a user opens the info sheet for a tour with a track
- **THEN** a "Download GPX" button is visible and clicking it downloads the original `.gpx` file

#### Scenario: Tour without track
- **WHEN** a user opens the info sheet for a tour with `gpx_filepath = null`
- **THEN** the download button is not shown

### Requirement: Internationalisation
The system SHALL provide all GPX-related user-facing text in both `en` and `de-CH` locales, accessed via `vue-i18n` keys.

#### Scenario: New keys present in both locales
- **WHEN** the locale switcher toggles between English and Swiss German
- **THEN** every GPX-related label, button, and error message renders translated text in the active locale
