## REMOVED Requirements

### Requirement: Tour filters

**Reason**: The Friends tab no longer offers a partner filter, and the grade filter is additive.
**Migration**: Replaced by "Tour filter categories".

### Requirement: Filter UI density

**Reason**: The filters are no longer an overlay over the rows; an overlay sized by the filtered list squeezed the panel on a phone.
**Migration**: Replaced by "Filters view".

### Requirement: Pinned summary row in the filter panel

**Reason**: The pinned row overlapped chips and intercepted taps.
**Migration**: The count and reset move to the footer — see "Filters footer actions".

### Requirement: Filter panel dismissal

**Reason**: Pointer-outside dismissal closed the filters when the sheet's handle was dragged.
**Migration**: Replaced by "Filters view dismissal".

### Requirement: Grade filter

**Reason**: Range picking (tap, tap again to widen) did not match how users read the chips.
**Migration**: Replaced by "Additive grade filter".

### Requirement: People filters on the Friends tab

**Reason**: The Friends tab filters by who recorded a tour only.
**Migration**: Replaced by "Recorded-by filter on the Friends tab".

### Requirement: Filter panel scroll ends with its content

**Reason**: The filters are in the sheet's normal flow now; nothing sits beneath them to scroll into.
**Migration**: Covered by "Filters view".

## ADDED Requirements

### Requirement: Tour filter categories

The list SHALL filter by activity type, grade, season, planned-date range and completion status, plus partner on the My Tours tab and the friend who recorded the tour on the Friends tab. A tour SHALL appear only when it satisfies every active filter (logical AND across categories). When no filters are active, all tours SHALL pass.

#### Scenario: Partner filter

- **WHEN** on the My Tours tab the partner filter holds a set of one or more contact IDs
- **THEN** a tour SHALL match only when `tour.partnerIds` intersects the selected set (at least one partner in common)

#### Scenario: No partner filter on the Friends tab

- **WHEN** the Friends tab is active
- **THEN** the filters SHALL NOT offer a partner filter

#### Scenario: Recorded-by filter

- **WHEN** on the Friends tab the recorded-by filter holds one or more friends
- **THEN** a tour SHALL match only when one of them recorded (owns) it

#### Scenario: Recorded-by filter absent on My Tours

- **WHEN** the My Tours tab is active
- **THEN** the filters SHALL NOT offer the recorded-by filter

#### Scenario: Activity-type filter

- **WHEN** the activity-type filter holds one or more `TourType` values
- **THEN** a tour SHALL match only when at least one of its activity types is among the selected values; a tour with no type SHALL NOT match

#### Scenario: Multi-activity tour matches any of its types

- **WHEN** the activity-type filter holds only `hiking` and a tour has types `skitour` and `hiking`
- **THEN** the tour SHALL match

#### Scenario: Grade filter

- **WHEN** the grade filter holds T2 and T4
- **THEN** tours graded T2 or T4 SHALL match
- **AND** tours graded T3, tours graded only on another scale, and ungraded tours SHALL NOT match

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

### Requirement: Filters view

Filter controls SHALL be collapsed behind a "Filters" trigger in the search row, with a badge counting active filter categories (search does not count). Opened, the filters SHALL replace the tour rows in the sheet's or drawer's normal flow, below the tabs and the search row, as the only scrolling region. Their layout SHALL depend on the tab's tours only, never on how many match, so selecting or clearing a filter SHALL NOT resize the filters or move any control.

#### Scenario: Filters hidden by default

- **WHEN** the list opens
- **THEN** the search input and tour rows SHALL be visible and the filters hidden behind the trigger

#### Scenario: Badge reflects active filter count

- **WHEN** the user has selected two partners and a completion status of `done`
- **THEN** the trigger SHALL display a badge with the value `2`

#### Scenario: Opening the filters

- **WHEN** the user activates the trigger
- **THEN** the filters SHALL take the rows' place, with the tabs and the search row still above them
- **AND** the sheet SHALL scroll them as its one scrolling region

#### Scenario: A selection that thins the list

- **WHEN** the filters are open and the user taps a chip that leaves one matching tour
- **THEN** no filter group, chip or footer action SHALL move or change size

#### Scenario: Sheet size on a phone

- **WHEN** the filters open in the bottom sheet
- **THEN** the sheet SHALL open them at their content height, at most 70% of the visible viewport, and SHALL be draggable up to 90%
- **AND** dragging the sheet SHALL NOT close the filters

#### Scenario: Glove-sized targets

- **WHEN** the filters are shown
- **THEN** every chip, date field and status option SHALL be at least 44px tall

#### Scenario: Same presentation in both shells

- **WHEN** the list is rendered in the desktop side drawer
- **THEN** the filters SHALL take the rows' place there too, scrolling within the drawer below the search row

### Requirement: Filters footer actions

While the filters are open, the sheet or drawer footer SHALL hold a "Reset" action and a primary "Show N tours" action, visible at every scroll position. N SHALL be the number of rows the list shows on close (search and filters together, an outing counted once). "Show N tours" SHALL close the filters. "Reset" SHALL stay in place, disabled, while no filter is active.

#### Scenario: Count reflects search and filters together

- **WHEN** a search query and one or more filters are both active
- **THEN** N SHALL equal the number of rows displayed once the filters close

#### Scenario: Count updates as facets change

- **WHEN** the user toggles a filter facet
- **THEN** N SHALL update without closing the filters

#### Scenario: No active filters

- **WHEN** no filter is active
- **THEN** "Reset" SHALL be shown disabled

### Requirement: Filters view dismissal

The filters SHALL close via the trigger, the "Show N tours" action and the Escape key. Pointers elsewhere, including dragging the sheet, SHALL NOT close them. Closing SHALL show the filtered rows and preserve the selection.

#### Scenario: Escape while typing in search

- **WHEN** focus is in the search input and the user presses Escape
- **THEN** the filters SHALL close and the sheet SHALL stay open

#### Scenario: Switching tabs keeps the filters open

- **WHEN** the filters are open and the user activates the other tab
- **THEN** the filters SHALL stay open and present the selection stored for that tab

#### Scenario: Filters are closed after remount

- **WHEN** the user opens a tour detail view and returns to the list
- **THEN** the filters SHALL be closed and the previously selected filters SHALL still be active

### Requirement: Additive grade filter

The grade filter SHALL offer one chip row per closed scale in use on the tab's tours — SAC hiking T1–T6, SAC alpine L–EX, singletrail S0–S5 — in aligned columns, each scale on one row. Each chip SHALL toggle its grade on its own. A tour SHALL match when any part of its grade leads with a selected grade, so a modifier keeps its base grade.

#### Scenario: Modifier keeps its base grade

- **WHEN** the grade filter holds WS and ZS
- **THEN** tours graded "WS-", "ZS+" or "ZS+ (III)" SHALL match
- **AND** a tour graded "S-" SHALL NOT match

#### Scenario: Free-text grade never matches

- **WHEN** any grade is selected
- **THEN** a tour graded only in free text outside the closed scales (e.g. "5c", "6a+") SHALL NOT match

#### Scenario: Any selected part passes

- **WHEN** the grade filter holds T4 only and a tour is graded "S2, T4"
- **THEN** the tour SHALL match
- **WHEN** the grade filter holds T3 and S1 and a tour is graded "S2, T4"
- **THEN** the tour SHALL NOT match

#### Scenario: Toggling a grade

- **WHEN** T2 is selected and the user taps T4, then taps T2
- **THEN** T4 alone SHALL be selected, and no grade between them SHALL be

#### Scenario: Only scales in use are offered

- **WHEN** the active tab's tours carry grades on the hiking scale only
- **THEN** the grade filter SHALL offer the hiking row alone
- **AND** a scale holding a selected grade SHALL stay offered even when no tour uses it
- **AND** when no tour carries a closed-scale grade and no grade is selected, the grade filter SHALL NOT be shown

#### Scenario: Grade counts as one filter

- **WHEN** grades on two scales are selected
- **THEN** the filters badge SHALL count the grade filter once

### Requirement: Recorded-by filter on the Friends tab

On the Friends tab the recorded-by chips SHALL be the friends who recorded at least one of the tab's tours, named as the viewer saved them in their contacts and ordered by label. A friend selected SHALL stay offered while selected. Chip labels SHALL render once in final form; until they settle, the group SHALL hold its place.

#### Scenario: Friend without tours stays clearable

- **WHEN** the recorded-by filter holds a friend who recorded none of the tab's tours
- **THEN** that friend's chip SHALL still be shown, selected, so it can be cleared

#### Scenario: Names still settling

- **WHEN** the filters open before the friends' names have resolved
- **THEN** the recorded-by group SHALL hold one chip row of space and show no chip until every label is final

## MODIFIED Requirements

### Requirement: No-results state and clear filters

The list SHALL provide two distinct reset controls, with deliberately different scope:

- The **filtered empty state**, shown when the tour list is non-empty but search + filters yield zero matches, SHALL offer a "Clear filters" action that resets every filter **and** the search query — nothing matched, so the query is the likely culprit.
- The filters' **"Reset"** footer action SHALL reset the filters but SHALL preserve the search query, because the search input remains visible above the open filters.

Neither control SHALL close the overlay. Clearing on one tab SHALL NOT affect the other tab's filters.

#### Scenario: Filtered empty state

- **WHEN** `useToursStore.tours` is non-empty but the filtered result is empty
- **THEN** the component SHALL render "No tours match your filters." with a "Clear filters" button

#### Scenario: Empty-state clear resets search too

- **WHEN** the user activates "Clear filters" in the filtered empty state
- **THEN** the search query SHALL be cleared, every filter SHALL return to its inactive default, the overlay SHALL remain open, and the list SHALL re-render with all tours

#### Scenario: Panel clear preserves the search query

- **WHEN** the user has both a search query and active filters, and activates "Reset" in the filters footer
- **THEN** the filters SHALL be reset
- **AND** the search query SHALL be preserved

#### Scenario: Clearing applies to the active tab only

- **WHEN** the user clears filters on one tab
- **THEN** the other tab's filters SHALL be unaffected

### Requirement: Filter panel accessibility

The filters SHALL expose their expanded state and accessible name to assistive technology, and SHALL manage focus on open and close. They SHALL be announced as a non-modal region, since content outside them remains operable.

#### Scenario: Trigger exposes panel state

- **WHEN** the filters are open or closed
- **THEN** the trigger SHALL reflect the state via `aria-expanded`
- **AND** SHALL reference the filters via `aria-controls`

#### Scenario: Focus moves into the panel on open

- **WHEN** the user opens the filters
- **THEN** focus SHALL move to the filters region without scrolling the tabs and search row out of view

#### Scenario: Focus returns to the trigger on close

- **WHEN** the filters are closed by the trigger, "Show N tours" or Escape
- **THEN** focus SHALL return to the trigger

#### Scenario: Panel has an accessible name

- **WHEN** the filters are rendered
- **THEN** they SHALL expose an accessible name sourced from a localized string present in every locale file
