## ADDED Requirements

### Requirement: Self-contained app shell (no external font origin)

The app shell SHALL be self-contained: all fonts and icons SHALL be bundled and precached by the service worker, with no runtime dependency on an external font CDN or any third-party origin for fonts or icons. Fonts and icons SHALL render on first paint and while offline.

#### Scenario: Icons and text render offline

- **WHEN** the app is opened offline (after installation)
- **THEN** Inter text and all icons render from precached bundle assets, with no failed third-party font requests

#### Scenario: No third-party font request on load

- **WHEN** the app loads with network access
- **THEN** no request is made to `fonts.googleapis.com` or `fonts.gstatic.com` (or any external font host)

#### Scenario: Icons present on first paint

- **WHEN** the first frame of the UI paints, before any deferred bootstrap work completes
- **THEN** icons already render at their correct size (bundled SVG), with no font-load race that could alter layout
