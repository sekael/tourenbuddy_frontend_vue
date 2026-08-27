## MODIFIED Requirements

### Requirement: Tours list overlay

A `TourListSheet` component SHALL render inside `AdaptiveOverlay` with the title "Tours" and display every tour returned by `useToursStore.tours` for the authenticated user. The component SHALL emit a `close` event when the user dismisses the overlay.

Tour rows SHALL NOT display a planned date, in any form, for single-day or multi-day tours: the activity-type avatar is the row's identity at a glance.

> Documentation-only correction. The previous text required each row to show "the planned date (formatted or 'No date')". `tour-list-row.vue` has rendered no date since the tour-identity-display change replaced it with the type avatar, so the requirement described a field that does not exist. No code changes under this requirement.

#### Scenario: Add-tour icon rendered in sheet header

- **WHEN** `TourListSheet` is mounted for an authenticated user
- **THEN** an icon-only Add-tour button SHALL be visible in the sheet header, adjacent to the close button
- **AND** SHALL NOT appear inside the scrollable list region

#### Scenario: Activating add-tour emits event

- **WHEN** the user activates the Add-tour button
- **THEN** `TourListSheet` SHALL emit an `add-tour` event
- **AND** SHALL NOT mutate `useToursStore` or `useMapStore`

#### Scenario: Add-tour disabled when unauthenticated

- **WHEN** the user is not authenticated
- **THEN** the Add-tour button SHALL render disabled with the existing `signInToAddToursTooltip` tooltip text

#### Scenario: Add-tour visible in both mobile and desktop layouts

- **WHEN** `TourListSheet` is rendered on a viewport below 600px AND on a viewport at or above 600px
- **THEN** the header Add-tour icon SHALL be present in both layouts

#### Scenario: Overlay opens with all user tours

- **WHEN** the user opens the Tours overlay and `useToursStore.tours` contains one or more tours
- **THEN** the component SHALL render one row per tour, showing the tour name (or "Unnamed tour" when `name` is null), an avatar carrying the tour type's icon and colour, and a subtitle naming the partners (own tours) or the owning friend (friend tours)
- **AND** each row SHALL render with the same spacing, typography, and hover treatment as a contact row in `ContactsListSheet`

#### Scenario: Multi-day tour row is indistinguishable from a single-day row

- **WHEN** a tour with an end date is rendered in the list
- **THEN** its row SHALL carry no date and no span indicator

#### Scenario: Overlay shows loading state

- **WHEN** `useToursStore.isLoading` is `true` and `tours` is empty
- **THEN** the component SHALL render a centered "Loading…" indicator matching the contacts list loading state

#### Scenario: Overlay empty state with no tours

- **WHEN** `useToursStore.tours` is empty and `isLoading` is `false`
- **THEN** the component SHALL render an empty state with a map/location icon, a heading "No tours yet." and a subline instructing the user to create one from the map

#### Scenario: Close via overlay chrome

- **WHEN** the user dismisses the overlay (close button, scrim tap, Escape)
- **THEN** the component SHALL emit a `close` event and SHALL NOT mutate any store

### Requirement: Tour filters

The overlay SHALL expose filters for partner, activity type, season, planned-date range, and completion status. A tour SHALL appear in the filtered list only when it satisfies every active filter (logical AND across filter categories). When no filters are active, all tours SHALL pass.

#### Scenario: Partner filter

- **WHEN** the partner filter holds a set of one or more contact IDs
- **THEN** a tour SHALL match only when `tour.partnerIds` intersects the selected set (at least one partner in common)

#### Scenario: Activity-type filter

- **WHEN** the activity-type filter holds one or more `TourType` values
- **THEN** a tour SHALL match only when `tour.tourType` is non-null and is one of the selected values

#### Scenario: Season filter

- **WHEN** the season filter holds one or more `Season` values
- **THEN** a tour SHALL match only when `tour.seasons` is non-null and intersects the selected set

#### Scenario: Planned-date range filter uses span overlap

- **WHEN** the user sets a `from` date, a `to` date, or both
- **THEN** a tour SHALL match only when `tour.plannedDate` is non-null and the tour's span —
  `plannedDate` through `endDate`, or `plannedDate` alone when `endDate` is null — intersects
  the inclusive filter range; tours with `plannedDate === null` SHALL be excluded

#### Scenario: Multi-day tour straddling the filter boundary

- **WHEN** a tour runs 25–27 August and the filter range is 26–30 August
- **THEN** the tour SHALL match, even though its planned (start) date lies before `from`

#### Scenario: Multi-day tour entirely outside the range

- **WHEN** a tour runs 1–3 August and the filter range is 26–30 August
- **THEN** the tour SHALL NOT match

#### Scenario: Planned-date filter inactive

- **WHEN** both `from` and `to` are empty
- **THEN** the planned-date filter SHALL NOT exclude any tour, including tours with `plannedDate === null`

#### Scenario: Completion-status filter tri-state

- **WHEN** the completion filter is `all`
- **THEN** no tour SHALL be excluded by this filter
- **WHEN** the filter is `done`
- **THEN** only tours with `completed === true` SHALL match
- **WHEN** the filter is `open`
- **THEN** only tours with `completed === false` SHALL match

#### Scenario: Filters combine with search

- **WHEN** a search query and one or more filters are active
- **THEN** a tour SHALL appear only when it satisfies both the search predicate and every active filter
