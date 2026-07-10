## ADDED Requirements

### Requirement: Calendar route and full-screen shell

The system SHALL provide a `/calendar` route that renders a full-screen calendar
page on both mobile and desktop with no map chrome. The route SHALL require
authentication and a complete profile, consistent with the map page. The page
SHALL present two views, **Planned** and **Seasons**, and SHALL open on the
**Planned** view by default unless a `view` query parameter selects otherwise.
The selected view SHALL NOT be persisted across visits.

#### Scenario: Unauthenticated access is redirected

- **WHEN** an unauthenticated user navigates to `/calendar`
- **THEN** the router redirects them away from the calendar, as it does for the
  map page

#### Scenario: Deep link selects a view

- **WHEN** the user navigates to `/calendar?view=seasons`
- **THEN** the page opens with the Seasons view active

#### Scenario: Default view

- **WHEN** the user opens `/calendar` with no `view` parameter
- **THEN** the Planned view is active

### Requirement: View navigation shell

The page SHALL provide navigation between the Planned and Seasons views via a
persistent left sidebar on desktop that collapses to a bottom navigation bar on
mobile, and a top app bar carrying the back control and per-view context (the
current month with previous/next controls on the Planned view; a static title on
the Seasons view).

#### Scenario: Switching views via the navigation

- **WHEN** the user selects the other view in the sidebar or bottom navigation
- **THEN** the page shows that view and reflects it in the `view` query parameter

#### Scenario: Navigation adapts to viewport

- **WHEN** the page is viewed on a narrow (mobile) viewport
- **THEN** the view navigation renders as a bottom navigation bar rather than a
  left sidebar

### Requirement: Back navigation to the tour list

The calendar page SHALL provide a back control in the top app bar that returns
the user to the tour-list view on the map page.

#### Scenario: Back control opens the tour list on the map

- **WHEN** the user taps the calendar page's back control
- **THEN** the app navigates to the map page **and** the tour-list overlay is
  opened

### Requirement: Seasons view shows owned tours by season

The Seasons view SHALL display a Gantt-style chart with a fixed horizontal axis
of four season columns ordered `Winter → Spring → Summer → Fall`, each labelled
with its month range, and a scrollable list of the user's **own** tours. Each
tour row SHALL draw one bar per contiguous run of the seasons the tour is tagged
with: adjacent tagged seasons SHALL merge into a single bar spanning their
columns, non-contiguous runs SHALL render as separate bars, and untagged season
columns SHALL never be bridged. The view SHALL draw a thin vertical marker line
at the position of the current month along the season axis, indicating the
current season. Friend tours SHALL NOT appear on the Seasons view. On narrow
(mobile) viewports the four season columns MAY exceed the viewport width; the
chart SHALL then scroll horizontally with the header row pinned, and SHALL show
an affordance indicating more columns are available by scrolling.

#### Scenario: Narrow viewport scrolls the season columns

- **WHEN** the Seasons view is shown on a viewport too narrow for all four season
  columns
- **THEN** the chart scrolls horizontally to reveal the remaining columns and
  displays a hint that scrolling reveals the full year

#### Scenario: Contiguous seasons merge into one bar

- **WHEN** a tour is tagged with `spring` and `summer`
- **THEN** its row draws a single bar spanning the spring and summer columns

#### Scenario: Non-contiguous seasons render as separate bars

- **WHEN** a tour is tagged with `winter` and `summer` but not `spring`
- **THEN** its row draws a bar in the winter column and a separate bar in the
  summer column, leaving spring and fall empty

#### Scenario: Tour without seasons

- **WHEN** a tour has no seasons tagged
- **THEN** its row appears with no bars and an empty-state label instead

#### Scenario: Current season is marked

- **WHEN** the Seasons view is displayed
- **THEN** a thin vertical marker line is drawn over the season column that
  contains the current month, indicating the current season

#### Scenario: Friend tours excluded

- **WHEN** the user has friend tours where they are a marked partner
- **THEN** those tours do NOT appear on the Seasons view

### Requirement: Planned view shows a month calendar

The Planned view SHALL render a monthly calendar, plotting each displayed tour on
its planned date as a pill carrying the tour's type icon and name. On desktop it
SHALL render a Monday-start grid with days from adjacent months de-emphasised. On
narrow (mobile) viewports it SHALL instead render a month-bounded vertical list
with one tile per day of the visible month — **including days without tours**, so
free dates stay visible for planning — each day's tours shown as full-width pills.
Both layouts are driven by the same month cursor and header navigation. Month
navigation SHALL be unbounded, presenting previous/next month controls flanking
a centered month-and-year label, plus a "Today" control that returns the calendar
to the month containing the current date. The cell for the current date SHALL be
visually distinguished from other days (a darker tile border and a light
background tint). The calendar SHALL display the user's own tours that have a
planned date **and** friend tours where the user is a marked partner that have a
planned date. Tours without a planned date SHALL NOT be displayed.

#### Scenario: Mobile renders a day-tile list

- **WHEN** the Planned view is shown on a narrow (mobile) viewport
- **THEN** it renders one tile per day of the visible month, including days with
  no tours, rather than the desktop grid

#### Scenario: Tour without a planned date is hidden

- **WHEN** a tour has no planned date
- **THEN** it is not shown anywhere on the Planned view

#### Scenario: Partner friend tour appears

- **WHEN** a friend tour has a planned date and the user is a marked partner on
  it
- **THEN** that tour appears on the calendar on its planned date

#### Scenario: Non-partner friend tour is hidden

- **WHEN** a friend tour has a planned date but the user is NOT a marked partner
- **THEN** that tour does not appear on the calendar

#### Scenario: The current day is highlighted

- **WHEN** the visible month contains the current date
- **THEN** that day's cell is rendered with a darker border and a light
  background tint distinguishing it from the other days

#### Scenario: The Today control returns to the current month

- **WHEN** the user has paged to a different month and taps the "Today" control
- **THEN** the calendar returns to the month containing the current date

#### Scenario: Clicking an empty day does nothing

- **WHEN** the user clicks a day cell that has no tour
- **THEN** nothing happens (no navigation, no selection)

### Requirement: Selecting a tour opens its detail with calendar origin

Selecting a tour from either calendar view SHALL navigate to the map page, select
that tour, and open its detail view (map + info sheet), while recording the
originating view so that detail back-navigation can return to it. On the Seasons
view the whole tour row SHALL be the selection target; on the Planned view the
tour's pill SHALL be the selection target.

#### Scenario: Selecting a tour from the Seasons view

- **WHEN** the user taps a tour row on the Seasons view
- **THEN** the app navigates to the map page, selects the tour, opens its detail
  view, and records `seasons` as the detail origin

#### Scenario: Selecting a tour from the Planned view

- **WHEN** the user taps a tour pill on the Planned calendar
- **THEN** the app navigates to the map page, selects the tour, opens its detail
  view, and records `planned` as the detail origin

### Requirement: Detail back returns to the originating calendar view

When a tour detail view was opened from the calendar, its back control SHALL
return the user to the `/calendar` page on the view it was opened from.

#### Scenario: Back from a Seasons-originated detail

- **WHEN** a tour detail was opened from the Seasons view and the user taps the
  detail back control
- **THEN** the app navigates to `/calendar` with the Seasons view active

#### Scenario: Back from a Planned-originated detail

- **WHEN** a tour detail was opened from the Planned view and the user taps the
  detail back control
- **THEN** the app navigates to `/calendar` with the Planned view active

### Requirement: Dismissing detail does not return to the calendar

The system SHALL clear the calendar origin and keep the user on the plain map
page when a calendar-originated tour detail view is dismissed by the close button
or by clicking the map.

#### Scenario: Dismiss via close button

- **WHEN** a calendar-originated tour detail is dismissed with its close button
- **THEN** the detail closes, the user stays on the map page, and the back
  control no longer offers a return to the calendar

#### Scenario: Dismiss via map click

- **WHEN** a calendar-originated tour detail is dismissed by clicking the map
- **THEN** the detail closes, the user stays on the map page, and no return to
  the calendar occurs

### Requirement: Calendar view follows the existing design system

The calendar page SHALL use the application's existing design tokens, custom
properties, and shared components (buttons, icon buttons) rather than introducing
bespoke styling, and all user-facing text SHALL be provided through the i18n
layer for every supported locale.

#### Scenario: Localized strings

- **WHEN** the calendar page renders in a supported locale
- **THEN** all its labels come from the locale files with no hard-coded
  user-facing strings

#### Scenario: A calendar library, if introduced, is themed to the design system

- **WHEN** a third-party calendar library is used for the Planned grid instead of
  the hand-rolled grid
- **THEN** it is styled with the application's design tokens rather than the
  library's default theme
