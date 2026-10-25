## MODIFIED Requirements

### Requirement: Tour type enum

A Zod enum (`tour-type.ts`) SHALL define the allowed tour activity types, mirrored by the `tours_tour_types_check` constraint: `skiing`, `snowboarding`, `skitour`, `splitboarding`, `ski-mountaineering`, `paragliding`, `hiking`, `mountaineering`, `climbing`, `mountain-biking`, `trailrunning`. Each type SHALL map to an i18n key, an icon, a marker colour, a darker track colour and a lighter preview colour. A tour SHALL carry a list of zero or more distinct types (`tour_types`, never null), kept in the enum's order; the first entry is the tour's primary type.

#### Scenario: Valid tour type parsed

- **WHEN** a tour row contains a `tour_types` list whose values all match enum values
- **THEN** the schema SHALL parse it into a `TourType[]` in the same order

#### Scenario: Null tour type

- **WHEN** a tour row has an empty `tour_types` list
- **THEN** the schema SHALL accept it and the tour SHALL have no primary type

#### Scenario: Unknown type rejected by the database

- **WHEN** a write stores a `tour_types` list containing a value outside the enum
- **THEN** the database SHALL reject the write

#### Scenario: Legacy single-type snapshot

- **WHEN** a tour cached or queued offline by a build before this change carries a single `tourType` and no `tourTypes`
- **THEN** the app SHALL read it as a one-element type list (or an empty list when the type was null)

### Requirement: Extended TourDraft

The `TourDraft` interface SHALL be expanded to include all new fields: `tourTypes`,
`elevation`, `gpxFilepath`, `description`, `seasons`, `startPoint`, `endPoint`,
`startPointName`, `startPointElevation`, `endPointName`, `endPointElevation`, `equipment`,
`notes`, `endDate`, and the optional `completed` and `visibility`.

#### Scenario: Draft with all fields

- **WHEN** a TourDraft is created with all new fields populated
- **THEN** it SHALL be a valid TourDraft object

#### Scenario: Draft with no new fields (backward compatible)

- **WHEN** a TourDraft is created with only name, plannedDate, and partnerIds
- **THEN** it SHALL be valid with all new fields defaulting to null/undefined, and the tour
  SHALL be persisted as a single-day tour with no activity type
