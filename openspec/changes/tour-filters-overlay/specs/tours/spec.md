## MODIFIED Requirements

### Requirement: Tour list header composition

The tour list sheet SHALL present a header block that remains visible regardless of the list's scroll position, containing the tab switcher and a single row holding the search field and the filters trigger. The header SHALL be positioned outside the list's scroll container rather than pinned inside it with `position: sticky`.

The header SHALL have the same number of rows on both tabs, so that switching tabs does not change the height of the list region.

#### Scenario: Search and filters trigger share one row

- **WHEN** the tour list sheet is rendered
- **THEN** the search input and the Filters trigger button SHALL occupy a single row
- **AND** the search input SHALL flex to fill the available width while the Filters trigger keeps its intrinsic width

#### Scenario: Header stays visible while rows scroll

- **WHEN** the user scrolls the tour rows
- **THEN** the tabs and the search/filters row SHALL remain in place
- **AND** no tour row content SHALL be visible above or through the header

#### Scenario: Narrow viewport does not wrap the row

- **WHEN** the sheet is rendered at a narrow width
- **THEN** the search/filters row SHALL NOT wrap to a second line
- **AND** the search input SHALL shrink instead

#### Scenario: Switching tabs does not change header height

- **WHEN** the user switches between My Tours and Friends
- **THEN** the header SHALL keep the same height
- **AND** the list region SHALL NOT change height as a result of the switch

### Requirement: Backfill entry point in the shell header

The backfill collisions entry point SHALL be presented as an icon button in the shell's header actions, shown only on the Friends tab when the user has at least one friendship. It SHALL expose a localized accessible name, and on desktop SHALL additionally surface that name as a tooltip.

#### Scenario: Hidden on the owned tab

- **WHEN** the My Tours tab is active
- **THEN** the backfill icon button SHALL NOT be rendered

#### Scenario: Hidden without friendships

- **WHEN** the Friends tab is active and the user has no friendships
- **THEN** the backfill icon button SHALL NOT be rendered

#### Scenario: Opens the embedded backfill view

- **WHEN** the user activates the backfill icon button
- **THEN** the sheet body SHALL be replaced by the backfill view
- **AND** returning from it SHALL restore the prior tab, search, and filter state

### Requirement: Filter panel presented as an overlay

The expanded filter panel SHALL render as an overlay covering the tour list region only, in both the bottom-sheet and side-drawer shells. It SHALL NOT participate in the tour list's scroll flow, and SHALL NOT cover the tab switcher, the search/filters row, or the shell header.

#### Scenario: Panel overlays the rows without displacing them

- **WHEN** the user expands the filters
- **THEN** the panel SHALL cover the region occupied by the tour rows
- **AND** the tour rows SHALL NOT be pushed down or reflowed

#### Scenario: Panel does not scroll with the list

- **WHEN** the filter panel is expanded and the region beneath it holds more rows than fit
- **THEN** the panel SHALL remain fixed over the list region
- **AND** the panel's position SHALL NOT change in response to the list's scroll offset

#### Scenario: Panel is opaque

- **WHEN** the filter panel is expanded over a populated list
- **THEN** tour row content SHALL NOT be visible through the panel

#### Scenario: Same presentation in both shells

- **WHEN** the sheet is rendered on desktop in the side drawer
- **THEN** the panel SHALL be presented as an overlay, as it is in the bottom sheet

#### Scenario: Panel enters with a downward slide

- **WHEN** the user expands the filters
- **THEN** the panel SHALL animate downward from beneath the search row
- **AND** the animation SHALL be clipped to the list region

#### Scenario: Reduced motion preference

- **WHEN** the user has requested reduced motion
- **THEN** the panel SHALL appear without a transition

### Requirement: Filter panel scrolling

The filter panel SHALL scroll within its own bounds, constrained to the height of the tour list region. Opening the panel SHALL NOT resize or re-snap the containing sheet.

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
- **AND** the panel SHALL occupy whatever height the list region currently has

### Requirement: Pinned summary row

The filter panel SHALL present a summary row pinned to the top of its scroll region, showing the live count of tours the list will display. The Clear filters control SHALL appear within that row only while at least one filter is active, and SHALL clear the active filters without clearing the search query.

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

#### Scenario: Clearing leaves the search query intact

- **WHEN** the user has both a search query and active filters, and activates Clear filters
- **THEN** the filters SHALL be reset
- **AND** the search query SHALL be preserved

#### Scenario: Clearing applies to the active tab only

- **WHEN** the user clears filters on one tab
- **THEN** the other tab's filters SHALL be unaffected

### Requirement: Filter panel dismissal

The filter panel SHALL be dismissable via the filters trigger, the Escape key, and a pointer interaction outside it. The tab switcher, search field, and filters trigger SHALL count as part of the panel's interactive surface and SHALL NOT dismiss it. On dismissal the filtered results SHALL be displayed as the normal list view.

#### Scenario: Escape collapses the panel

- **WHEN** the filter panel is expanded and the user presses Escape
- **THEN** the panel SHALL collapse
- **AND** focus SHALL return to the filters trigger

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

#### Scenario: Pointer on the shell header collapses the panel

- **WHEN** the panel is expanded and the user presses a pointer down on the shell header or outside the sheet
- **THEN** the panel SHALL collapse

#### Scenario: Pointer inside does not collapse the panel

- **WHEN** the user presses a pointer down on a filter chip or anywhere within the panel
- **THEN** the panel SHALL remain expanded

#### Scenario: Trigger toggles without reopening

- **WHEN** the panel is expanded and the user activates the filters trigger
- **THEN** the panel SHALL collapse and SHALL NOT immediately reopen from the same interaction

#### Scenario: Selected filters survive dismissal

- **WHEN** the user selects filters and then collapses the panel by any means
- **THEN** the list SHALL display the results matching those filters
- **AND** the active filter count on the trigger SHALL reflect the selection

#### Scenario: Panel is closed after remount

- **WHEN** the user opens a tour detail view and returns to the list
- **THEN** the filter panel SHALL be collapsed
- **AND** the previously selected filters SHALL still be active

### Requirement: Filter panel accessibility

The filter panel SHALL expose its expanded state and accessible name to assistive technology, and SHALL manage focus on open and close. It SHALL be announced as a non-modal region, since content outside it remains operable.

#### Scenario: Trigger exposes panel state

- **WHEN** the filter panel is expanded or collapsed
- **THEN** the filters trigger SHALL reflect the state via `aria-expanded`
- **AND** SHALL reference the panel via `aria-controls`

#### Scenario: Focus moves into the panel on open

- **WHEN** the user expands the filter panel
- **THEN** focus SHALL move to the panel

#### Scenario: Focus returns to the trigger on close

- **WHEN** the panel is collapsed by the trigger, Escape, or an outside pointer interaction
- **THEN** focus SHALL return to the filters trigger

#### Scenario: Panel has an accessible name

- **WHEN** the filter panel is rendered
- **THEN** it SHALL expose an accessible name sourced from a localized string present in every locale file
