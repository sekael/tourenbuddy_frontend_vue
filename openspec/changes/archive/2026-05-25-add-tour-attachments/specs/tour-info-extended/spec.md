## ADDED Requirements

### Requirement: Attachments list in tour info

The tour info sheet SHALL display the tour's attachments as a horizontal scrollable strip of thumbnails (image preview for images, generic PDF icon for PDFs) with filename labels, ordered by `sort_order`.

#### Scenario: Tour with attachments

- **WHEN** the tour has one or more attachments
- **THEN** the info sheet SHALL render a thumbnail strip with one entry per attachment

#### Scenario: Tour without attachments

- **WHEN** the tour has zero attachments
- **THEN** no attachments section SHALL be rendered

### Requirement: Open attachment in full-screen viewer

Tapping an attachment thumbnail in the info sheet SHALL open the full-screen viewer focused on that attachment, allowing horizontal flip between all attachments of the tour.

#### Scenario: Open viewer from thumbnail

- **WHEN** the user taps an attachment thumbnail
- **THEN** the full-screen viewer SHALL open with that attachment active AND the user SHALL be able to flip to the other attachments

### Requirement: Download attachment from viewer

The full-screen viewer SHALL expose a download control that saves the original file using its `original_filename`.

#### Scenario: User downloads

- **WHEN** the user taps the download control in the viewer
- **THEN** the browser SHALL save the file to the user's device using the original filename
