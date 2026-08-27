## MODIFIED Requirements

### Requirement: Planned view shows a month calendar

The Planned view SHALL render a monthly calendar, plotting each displayed tour on
**every day of its planned span** — from its planned (start) date through its end date
inclusive, or on its planned date alone when it has no end date — as a pill carrying the
tour's type icon and name. When a tour spans more than one day, each of its pills SHALL
additionally carry a day counter identifying that day's position in the span and the span's
total length (for example `2/3`); a single-day tour's pill SHALL carry no counter. On
desktop it SHALL render a Monday-start grid with days from adjacent months de-emphasised. On
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

Day keys for a span SHALL be derived by walking local calendar date parts, so a span
crossing a daylight-saving transition yields exactly one key per calendar day, and SHALL be
produced by the single shared span helper rather than computed at each call site.

#### Scenario: Multi-day tour appears on every day of its span

- **WHEN** a displayed tour has a planned date of 25 August and an end date of 27 August, and
  the Planned view shows August
- **THEN** a pill for that tour SHALL be rendered on 25, 26 and 27 August, labelled `1/3`,
  `2/3` and `3/3` respectively

#### Scenario: Running multi-day tour is visible on today

- **WHEN** today falls strictly between a displayed tour's planned date and its end date
- **THEN** the current-date cell SHALL show that tour's pill

#### Scenario: Single-day tour carries no counter

- **WHEN** a displayed tour has no end date
- **THEN** it SHALL appear only on its planned date and its pill SHALL show no day counter

#### Scenario: Span crossing a month boundary

- **WHEN** a tour spans 30 September to 2 October and the Planned view shows October
- **THEN** pills SHALL be rendered on 1 and 2 October, labelled `2/3` and `3/3`, i.e. the
  counter reflects the position within the whole span and not within the visible month

#### Scenario: Mobile renders a day-tile list

- **WHEN** the Planned view is shown on a narrow (mobile) viewport
- **THEN** it renders one tile per day of the visible month, including days with
  no tours, rather than the desktop grid

#### Scenario: Tour without a planned date is hidden

- **WHEN** a tour has no planned date
- **THEN** it SHALL NOT be plotted on the calendar in either layout

### Requirement: Detail back returns to the originating calendar view

When a tour detail view was opened from the calendar, its back control SHALL
return the user to the `/calendar` page on the view it was opened from. For a
Planned-originated detail it SHALL additionally return to the **day the detail was
opened from**, not to the tour's first day, whenever that day still falls within the
tour's current span. If the tour's span was edited in the detail such that the
originating day is no longer covered, the back control SHALL fall back to the tour's
planned (start) date.

#### Scenario: Back from a Seasons-originated detail

- **WHEN** a tour detail was opened from the Seasons view and the user taps the
  detail back control
- **THEN** the app navigates to `/calendar` with the Seasons view active

#### Scenario: Back from a Planned-originated detail

- **WHEN** a tour detail was opened from the Planned view and the user taps the
  detail back control
- **THEN** the app navigates to `/calendar` with the Planned view active

#### Scenario: Back from a detail opened on a middle day of a span

- **WHEN** a detail was opened from the second day of a three-day tour and the user
  taps the detail back control without editing the dates
- **THEN** the calendar re-opens the **second** day's detail list, not the first day's

#### Scenario: Span edited so the originating day is no longer covered

- **WHEN** a detail was opened from the third day of a span, the span is shortened in
  the detail so it no longer covers that day, and the user taps back
- **THEN** the calendar re-opens the day of the tour's planned (start) date
