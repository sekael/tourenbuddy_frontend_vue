## Purpose

Tour list page with filtering, sorting, and quick navigation to tour detail or map view.
## Requirements

### Requirement: Tours list overlay

A `TourListSheet` component SHALL render inside `AdaptiveOverlay` with the title "Tours" and display every tour returned by `useToursStore.tours` for the authenticated user. The component SHALL emit a `close` event when the user dismisses the overlay.

Tour rows SHALL NOT display a planned date, in any form, for single-day or multi-day tours: the activity-type avatar is the row's identity at a glance.

The tour list SHALL own its own scroll container rather than scrolling within the shell's. The header block (tabs, search, filters trigger) SHALL sit outside that scroll container, and SHALL therefore remain visible without `position: sticky`.

#### Scenario: List scrolls within its own region

- **WHEN** the list holds more rows than fit
- **THEN** the rows SHALL scroll within the list's own scroll container
- **AND** the header block SHALL remain visible without moving

#### Scenario: No content bleeds through the header

- **WHEN** the user scrolls the rows to any offset, at any sheet snap point
- **THEN** no row content SHALL be visible above or through the header block

#### Scenario: Add-tour icon rendered in sheet header

- **WHEN** `TourListSheet` is mounted for an authenticated user
- **THEN** an icon-only Add-tour button SHALL be visible in the sheet header, adjacent to the close button
- **AND** SHALL NOT appear inside the scrollable list region

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

The search input SHALL share a single row with the filters trigger. That row SHALL NOT wrap at narrow widths — the input SHALL shrink instead. The search input SHALL remain visible and operable while the filter panel is open.

#### Scenario: Search shares a row with the filters trigger

- **WHEN** the overlay is rendered
- **THEN** the search input and the filters trigger SHALL occupy one row
- **AND** the input SHALL flex to fill the remaining width

#### Scenario: Narrow viewport does not wrap the row

- **WHEN** the overlay is rendered at a narrow width
- **THEN** the row SHALL NOT wrap to a second line
- **AND** the search input SHALL shrink instead

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

The overlay SHALL provide two distinct reset controls, with deliberately different scope:

- The **filtered empty state**, shown when the tour list is non-empty but search + filters yield zero matches, SHALL offer a "Clear filters" action that resets every filter **and** the search query — nothing matched, so the query is the likely culprit.
- The **filter panel's** "Clear filters" control SHALL reset the filters but SHALL preserve the search query, because the search input remains visible above the open panel and its content is never hidden context.

Neither control SHALL close the overlay. Clearing on one tab SHALL NOT affect the other tab's filters.

#### Scenario: Filtered empty state

- **WHEN** `useToursStore.tours` is non-empty but the filtered result is empty
- **THEN** the component SHALL render "No tours match your filters." with a "Clear filters" button

#### Scenario: Empty-state clear resets search too

- **WHEN** the user activates "Clear filters" in the filtered empty state
- **THEN** the search query SHALL be cleared, every filter SHALL return to its inactive default, the overlay SHALL remain open, and the list SHALL re-render with all tours

#### Scenario: Panel clear preserves the search query

- **WHEN** the user has both a search query and active filters, and activates Clear filters inside the panel
- **THEN** the filters SHALL be reset
- **AND** the search query SHALL be preserved

#### Scenario: Clearing applies to the active tab only

- **WHEN** the user clears filters on one tab
- **THEN** the other tab's filters SHALL be unaffected

### Requirement: Selecting a tour opens its info sheet

Tapping a tour row SHALL call `mapStore.selectTour(tour.id)` and emit `close` so that the map page opens `TourInfoSheet` for the selected tour and flies the map to its goal.

#### Scenario: Row tap selects and closes

- **WHEN** the user taps a tour row in the list
- **THEN** `mapStore.selectTour` SHALL be called with that tour's `id`
- **AND** the component SHALL emit `close`
- **AND** the existing map-page machinery SHALL open `TourInfoSheet` and fly to the tour goal

### Requirement: Filter UI density

Filter controls SHALL be collapsed behind a "Filters" disclosure trigger by default. The trigger SHALL display a numeric badge equal to the count of currently active filter categories (search does not count). The search input SHALL always be visible.

When expanded, the filter controls SHALL be presented as an overlay layered over the tour list region, in both the bottom-sheet and side-drawer shells. They SHALL NOT expand in place within the scroll flow, SHALL NOT displace the tour rows, and SHALL NOT cover the tab switcher, the search/filters row, or the shell header. The panel SHALL be opaque.

The panel SHALL scroll within its own bounds, constrained to the height of the list region, and SHALL NOT chain its scroll to the list, the sheet, or the map. Expanding the panel SHALL NOT resize or re-snap the containing sheet.

The panel SHALL enter with a downward slide from beneath the search row, clipped to the list region, and SHALL appear without transition when the user has requested reduced motion.

#### Scenario: Filters hidden by default

- **WHEN** the overlay opens
- **THEN** the search input and tour list SHALL be visible and the filter controls SHALL be hidden behind the "Filters" trigger

#### Scenario: Badge reflects active filter count

- **WHEN** the user has selected two partners and a completion status of `done`
- **THEN** the "Filters" trigger SHALL display a badge with the value `2` (partner counts as one active category, completion counts as one active category; active = non-default)

#### Scenario: Expand filters overlays the rows

- **WHEN** the user taps the "Filters" trigger
- **THEN** the filter controls SHALL cover the region occupied by the tour rows
- **AND** the tour rows SHALL NOT be pushed down or reflowed
- **AND** the overlay SHALL NOT close or navigate away

#### Scenario: Panel does not scroll with the list

- **WHEN** the panel is expanded over a list holding more rows than fit
- **THEN** the panel's position SHALL NOT change in response to the list's scroll offset

#### Scenario: Panel is opaque

- **WHEN** the panel is expanded over a populated list
- **THEN** tour row content SHALL NOT be visible through it

#### Scenario: Panel content exceeds available height

- **WHEN** the filter groups are taller than the list region
- **THEN** the panel SHALL scroll internally
- **AND** the tour list beneath SHALL NOT scroll

#### Scenario: Scrolling past the panel's end does not chain

- **WHEN** the user scrolls beyond the panel's first or last filter group
- **THEN** the scroll SHALL NOT propagate to the tour list, the sheet, or the map behind it

#### Scenario: Sheet snap point is preserved

- **WHEN** the user expands the filters
- **THEN** the bottom sheet SHALL remain at its current snap point

#### Scenario: Same presentation in both shells

- **WHEN** the sheet is rendered on desktop in the side drawer
- **THEN** the panel SHALL be presented as an overlay, as it is in the bottom sheet

#### Scenario: Reduced motion preference

- **WHEN** the user has requested reduced motion
- **THEN** the panel SHALL appear without a transition

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

### Requirement: Pinned summary row in the filter panel

The filter panel SHALL present a summary row pinned to the top of its scroll region, always rendered, showing the live count of tours the list will display. That count SHALL reflect search and filters together, so it states exactly what appears on collapse. The panel's Clear filters control SHALL live within that row and SHALL appear only while at least one filter is active.

#### Scenario: Count reflects search and filters together

- **WHEN** a search query and one or more filters are both active
- **THEN** the count SHALL equal the number of tours matching both
- **AND** SHALL equal the number of rows displayed when the panel is collapsed

#### Scenario: Count updates as facets change

- **WHEN** the user toggles a filter facet
- **THEN** the count SHALL update without collapsing the panel

#### Scenario: Count reaches zero

- **WHEN** the active combination matches no tours
- **THEN** the count SHALL display zero while the panel remains open

#### Scenario: Row stays reachable while scrolling filter groups

- **WHEN** the user scrolls down through the filter groups
- **THEN** the summary row SHALL remain visible at the top of the panel
- **AND** filter chips scrolling beneath it SHALL NOT be visible through it

#### Scenario: No active filters

- **WHEN** the active filter count is zero
- **THEN** the summary row SHALL still render with its count
- **AND** the Clear filters control SHALL NOT be rendered

### Requirement: Filter panel dismissal

The filter panel SHALL be dismissable via the filters trigger, the Escape key, and a pointer interaction outside it. The tab switcher, search field, and filters trigger SHALL count as part of the panel's interactive surface and SHALL NOT dismiss it. On dismissal the filtered results SHALL be displayed as the normal list view, and the filter selection SHALL be preserved.

#### Scenario: Escape collapses the panel

- **WHEN** the panel is expanded and the user presses Escape
- **THEN** the panel SHALL collapse

#### Scenario: Escape while typing in search

- **WHEN** focus is in the search input and the user presses Escape
- **THEN** the panel SHALL collapse

#### Scenario: Interacting with the search field keeps the panel open

- **WHEN** the panel is expanded and the user presses a pointer down on the search input
- **THEN** the panel SHALL remain expanded
- **AND** the search input SHALL receive focus

#### Scenario: Switching tabs keeps the panel open

- **WHEN** the panel is expanded and the user activates the other tab
- **THEN** the panel SHALL remain expanded
- **AND** SHALL present the filter selection stored for the newly active tab

#### Scenario: Pointer outside the sheet collapses the panel

- **WHEN** the panel is expanded and the user presses a pointer down on the shell header or outside the sheet
- **THEN** the panel SHALL collapse

#### Scenario: Pointer inside does not collapse the panel

- **WHEN** the user presses a pointer down on a filter chip or anywhere within the panel
- **THEN** the panel SHALL remain expanded

#### Scenario: Trigger toggles without reopening

- **WHEN** the panel is expanded and the user activates the filters trigger
- **THEN** the panel SHALL collapse and SHALL NOT immediately reopen from the same interaction

#### Scenario: Panel is closed after remount

- **WHEN** the user opens a tour detail view and returns to the list
- **THEN** the filter panel SHALL be collapsed
- **AND** the previously selected filters SHALL still be active

### Requirement: Filter panel accessibility

The filter panel SHALL expose its expanded state and accessible name to assistive technology, and SHALL manage focus on open and close. It SHALL be announced as a non-modal region, since content outside it remains operable.

#### Scenario: Trigger exposes panel state

- **WHEN** the panel is expanded or collapsed
- **THEN** the filters trigger SHALL reflect the state via `aria-expanded`
- **AND** SHALL reference the panel via `aria-controls`

#### Scenario: Focus moves into the panel on open

- **WHEN** the user expands the panel
- **THEN** focus SHALL move to the panel

#### Scenario: Focus returns to the trigger on close

- **WHEN** the panel is collapsed by the trigger, Escape, or an outside pointer interaction
- **THEN** focus SHALL return to the filters trigger

#### Scenario: Panel has an accessible name

- **WHEN** the panel is rendered
- **THEN** it SHALL expose an accessible name sourced from a localized string present in every locale file

### Requirement: Backfill entry point in the sheet header

The backfill collisions entry point SHALL be an icon button in the sheet header alongside the other header actions, shown only on the Friends tab when the user has at least one friendship. It SHALL expose a localized accessible name, and on desktop SHALL additionally surface that name as a tooltip. It SHALL NOT occupy a row in the list header, so that the header keeps the same height on both tabs.

#### Scenario: Hidden on the owned tab

- **WHEN** the My Tours tab is active
- **THEN** the backfill icon button SHALL NOT be rendered

#### Scenario: Hidden without friendships

- **WHEN** the Friends tab is active and the user has no friendships
- **THEN** the backfill icon button SHALL NOT be rendered

#### Scenario: Header height is stable across tabs

- **WHEN** the user switches between My Tours and Friends
- **THEN** the list header SHALL keep the same height
- **AND** the list region SHALL NOT change height as a result of the switch

#### Scenario: Opens the embedded backfill view

- **WHEN** the user activates the backfill icon button
- **THEN** the sheet body SHALL be replaced by the backfill view
- **AND** returning from it SHALL restore the prior tab, search, and filter state
