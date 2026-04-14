## Why

Tours currently store only location, date, and partners. Real outdoor tour planning needs activity type, elevation, route data, descriptions, seasonal info, and logistics. Without these, users must track critical details externally, defeating the purpose of a dedicated tour-planning app. Issue #19 addresses this gap.

## What Changes

- **Tour type enum** — add activity type field: skiing/snowboarding, skitour/splitboarding, ski-mountaineering, paragliding, hiking, mountaineering, climbing, mountain biking, trailrunning
- **Elevation auto-retrieval** — query Swiss digital elevation model (Swisstopo REST API) to auto-populate elevation at the tour goal point; allow manual override
- **Name auto-suggestion** — attempt to resolve a place name (peak, pass, hut) from Swisstopo GeoAdmin API for the pinned location; user can accept or override
- **GPX track display** — optional GPX file upload, parse and render as polyline on MapLibre map
- **Description field** — free text with hyperlink support for guides/route descriptions
- **Season tags** — multi-select from winter, spring, summer, autumn (optional)
- **Start/end points** — optional secondary map locations; end point defaults to start point if not set
- **Equipment field** — free text for gear lists (optional)
- **Notes field** — free text for miscellaneous info (optional)
- **Adaptive UI** — tour creation dialog and info sheet gracefully handle any combination of filled/empty optional fields

All new fields are optional. Existing tours with only location/date/partners remain fully valid.

## Capabilities

### New Capabilities

- `tour-extended-model`: Expanded Zod schemas, domain entities, DB columns, and repository methods for all new tour fields
- `elevation-lookup`: Auto-retrieve elevation from Swisstopo digital elevation model API given coordinates
- `name-suggestion`: Auto-suggest tour name from Swisstopo GeoAdmin feature search API given coordinates
- `gpx-display`: GPX file upload, parsing, and polyline rendering on MapLibre map
- `tour-form-extended`: Extended tour creation/edit dialog with all new fields, adaptive layout
- `tour-info-extended`: Extended tour info sheet displaying all populated fields

### Modified Capabilities

- `tours`: Tour domain entity and schema updated with new optional fields; repository methods updated to persist/retrieve new fields

## Impact

- **Database**: `tours` table needs new columns (tour_type, elevation, description, season, start_point, end_point, equipment, notes); `tours_view` updated; `create_tour_with_partners` RPC updated or new RPC created
- **Supabase types**: `tourRowSchema` and `tourSchema` expanded with new fields
- **UI components**: `tour-creation-dialog.vue` significantly expanded; `tour-info-sheet.vue` gains new detail rows
- **External APIs**: New dependency on Swisstopo REST APIs (elevation + feature search) — free, no API key
- **Map layer**: New GPX polyline layer in MapLibre alongside existing circle markers
- **Bundle size**: GPX parsing library (or manual XML parse) added
