## Purpose

Tour list page with filtering, sorting, and quick navigation to tour detail or map view.
## Requirements

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

### Requirement: Calendar entry point in the tour list

The tour-list overview SHALL provide a calendar icon button in its header that
navigates the user to the `/calendar` calendar view.

#### Scenario: Opening the calendar from the tour list

- **WHEN** the user taps the calendar icon button in the tour-list header
- **THEN** the app navigates to the `/calendar` route and displays the calendar
  view

#### Scenario: Calendar button available regardless of active list tab

- **WHEN** the tour list is on either the Owned or the Friends tab
- **THEN** the calendar icon button remains visible and functional in the header


### Requirement: Tour rows are identified by activity type

Each tour row in the tour list SHALL lead with an avatar showing the tour's activity
type — the type's icon, tinted with the type's color from the same shared maps used by
the calendar and the map markers — instead of a letter derived from the tour's name. A
tour with no activity type SHALL render a generic tour icon on the list's neutral accent,
and SHALL NOT fall back to a letter or to a placeholder character. The avatar SHALL keep
its existing size, shape, and friend-tour badge overlay.

#### Scenario: Typed tour shows its activity icon

- **WHEN** a tour row renders for a tour whose activity type is set
- **THEN** the avatar shows that type's icon in that type's color, and no letter is rendered

#### Scenario: Untyped tour

- **WHEN** a tour row renders for a tour whose activity type is null
- **THEN** the avatar shows the generic tour icon on the neutral accent, and SHALL NOT
  render `?` or any character from the tour name

#### Scenario: Unnamed, untyped tour

- **WHEN** a tour row renders for a tour with neither a name nor an activity type
- **THEN** the row shows the "Unnamed tour" title beside the generic tour avatar, with no
  literal `?` anywhere in the row

#### Scenario: Friend badge remains legible over a tinted avatar

- **WHEN** a friend tour's row renders with a strongly tinted activity avatar
- **THEN** the friend badge remains visible against it, in the same corner position it
  occupies today

### Requirement: Pending-suggestion indicator on owned tour rows

A tour row in the list view SHALL show an indicator when the viewer owns that tour and it
carries pending suggestions, so the owner finds waiting proposals without opening each
tour. The count SHALL derive from the suggestion store's single user-scoped load, not from
a per-row query. Friend tours SHALL show no such indicator, and a tour with no pending
suggestions SHALL show none.

#### Scenario: Owned tour with pending suggestions
- **WHEN** the owner views the list and one of their tours has two pending suggestions
- **THEN** that row shows a pending indicator

#### Scenario: Resolved suggestions clear the indicator
- **WHEN** the owner resolves the last pending suggestion on a tour
- **THEN** the indicator disappears from that row without a manual reload

#### Scenario: Friend tour rows carry no indicator
- **WHEN** the list renders a friend's tour on which the viewer has authored a pending suggestion
- **THEN** no owner-facing pending indicator is shown on that row
