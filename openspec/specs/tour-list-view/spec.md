## Purpose

Tour list page with filtering, sorting, and quick navigation to tour detail or map view.

## Requirements

### Requirement: Tours list overlay

A `TourListSheet` component SHALL render inside `AdaptiveOverlay` with the title "Tours" and display every tour returned by `useToursStore.tours` for the authenticated user. The component SHALL emit a `close` event when the user dismisses the overlay.

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
- **THEN** the component SHALL render one row per tour, showing the tour name (or "Unnamed tour" when `name` is null), the planned date (formatted or "No date"), and a comma-separated list of partner names resolved via `useContactsStore`
- **AND** each row SHALL render with the same spacing, typography, and hover treatment as a contact row in `ContactsListSheet`

#### Scenario: Overlay shows loading state

- **WHEN** `useToursStore.isLoading` is `true` and `tours` is empty
- **THEN** the component SHALL render a centered "Loading…" indicator matching the contacts list loading state

#### Scenario: Overlay empty state with no tours

- **WHEN** `useToursStore.tours` is empty and `isLoading` is `false`
- **THEN** the component SHALL render an empty state with a map/location icon, a heading "No tours yet." and a subline instructing the user to create one from the map

#### Scenario: Close via overlay chrome

- **WHEN** the user dismisses the overlay (close button, scrim tap, Escape)
- **THEN** the component SHALL emit a `close` event and SHALL NOT mutate any store

### Requirement: Add-tour affordance inside the tour list sheet

`TourListSheet` SHALL render an icon-only Add-tour button in the sheet header (Material Symbols `add_location_alt`, accessible name from `tours.list.addTourAriaLabel`), positioned adjacent to the close button. Activating the button SHALL emit an `add-tour` event with no payload. The component SHALL NOT mutate any store directly — the consuming page is responsible for closing the list and entering the location-pick flow.

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

### Requirement: Tour search by name and partner

The overlay SHALL include a text search input. A tour SHALL be considered a match when the trimmed, case-insensitive query is a substring of either the tour's `name` or of any of the tour's partner names resolved via `useContactsStore`.

#### Scenario: Search matches tour name

- **WHEN** the user types a query that is a substring of a tour's `name` (case-insensitive)
- **THEN** that tour SHALL appear in the filtered list

#### Scenario: Search matches partner name

- **WHEN** the user types a query that is a substring of any resolved partner full name or display name of a tour
- **THEN** that tour SHALL appear in the filtered list

#### Scenario: Unnamed tour never matches name search

- **WHEN** a tour has `name === null` and the query is non-empty
- **THEN** the tour SHALL NOT match based on name (but MAY still match via partners)

#### Scenario: Empty query is neutral

- **WHEN** the search query is empty or whitespace only
- **THEN** the search SHALL NOT filter out any tour

#### Scenario: Partner with no contact record

- **WHEN** a tour's `partnerIds` contains an ID that has no matching entry in `useContactsStore.contacts`
- **THEN** that ID SHALL contribute an empty string to the partner name set and SHALL NOT cause an error

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

#### Scenario: Planned-date range filter

- **WHEN** the user sets a `from` date, a `to` date, or both
- **THEN** a tour SHALL match only when `tour.plannedDate` is non-null and falls within the inclusive range; tours with `plannedDate === null` SHALL be excluded

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

### Requirement: No-results state and clear filters

When the tour list is non-empty but search + filters yield zero matches, the overlay SHALL show a distinct empty state with a "Clear filters" action that resets every filter and the search query without closing the overlay.

#### Scenario: Filtered empty state

- **WHEN** `useToursStore.tours` is non-empty but the filtered result is empty
- **THEN** the component SHALL render "No tours match your filters." with a "Clear filters" button

#### Scenario: Clear filters resets state

- **WHEN** the user clicks "Clear filters"
- **THEN** the search query SHALL be cleared, every filter SHALL return to its inactive default, the overlay SHALL remain open, and the list SHALL re-render with all tours

### Requirement: Selecting a tour opens its info sheet

Tapping a tour row SHALL call `mapStore.selectTour(tour.id)` and emit `close` so that the map page opens `TourInfoSheet` for the selected tour and flies the map to its goal.

#### Scenario: Row tap selects and closes

- **WHEN** the user taps a tour row in the list
- **THEN** `mapStore.selectTour` SHALL be called with that tour's `id`
- **AND** the component SHALL emit `close`
- **AND** the existing map-page machinery SHALL open `TourInfoSheet` and fly to the tour goal

### Requirement: Filter UI density

Filter controls SHALL be collapsed behind a "Filters" disclosure trigger by default. The trigger SHALL display a numeric badge equal to the count of currently active filter categories (search does not count). The search input SHALL always be visible above the list.

#### Scenario: Filters hidden by default

- **WHEN** the overlay opens
- **THEN** the search input and tour list SHALL be visible and the filter controls SHALL be hidden behind the "Filters" trigger

#### Scenario: Badge reflects active filter count

- **WHEN** the user has selected two partners and a completion status of `done`
- **THEN** the "Filters" trigger SHALL display a badge with the value `2` (partner counts as one active category, completion counts as one active category; active = non-default)

#### Scenario: Expand filters

- **WHEN** the user taps the "Filters" trigger
- **THEN** the filter controls SHALL expand in-place within the overlay, without closing the overlay or navigating away
