## MODIFIED Requirements

### Requirement: Outing overview reads like a stage plan

The overview header SHALL give the days spanned and the segment count, the date span, the way
from the first start to the last finish when both are named, and the total climb and descent of
what the segments know. Each timeline card SHALL show the name with the goal height, activity,
date, and its climb and descent when known and not 0; between two segments the timeline SHALL mark the night where the next one starts on a
later day, at the previous segment's finish.

#### Scenario: Hut night in a two-day outing

- **WHEN** segment 1 (29 Nov) ends at a hut at 2632 m and segment 2 starts there on 30 Nov
- **THEN** the header SHALL read "2 days · 3 segments" with the totals, and the timeline SHALL mark the night at the hut with its height between segments 1 and 2

#### Scenario: Dates out of order

- **WHEN** segment 2 is dated a day before segment 1
- **THEN** the timeline SHALL say so between them, without blocking the order or changing a date

#### Scenario: First stage without a start

- **WHEN** the first stage has a goal and an end but no start
- **THEN** the header SHALL name no way, and the totals SHALL still show, that stage counting its goal → end leg only

#### Scenario: A segment's height missing

- **WHEN** one segment's start has no height
- **THEN** the totals SHALL still show, adding up the climb and descent the segments know
