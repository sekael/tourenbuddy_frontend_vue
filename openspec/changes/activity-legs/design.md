# Design

## D1 — Store both legs, keep the union

`ascent_types` and `descent_types` (text[]), both null or both non-empty, and `tour_types` =
their union (CHECK). Storing only the way down cannot tell "hike up, hike or fly down" from "hike
up, fly down"; both happen (a launch below the summit). Keeping `tour_types` as the union means
no reader of it changes, and an app that knows nothing of legs shows every activity.

## D2 — Stale writers

`update_tour_full` with null legs keeps them while the new `tour_types` is still their union, and
clears them otherwise: an older app that changed the activities can't leave legs that contradict
them. `{}` clears. The client sends the legs only from the form (undefined draft field = keep).

## D3 — The picker

The chips still choose the activities. With two or more, each gets Up / Both / Down, one line per
activity. Untouched lines follow the default (paragliding with others: down, the rest up; no
paragliding: both); a tapped line is the user's. Every line "both", or one leg empty, is no split.

## D4 — Display

Split tours list the way-up activities after "↑" and the way-down ones after "↓" (detail type
row, stage card meta), and order the activity disc up-first. A flown way down (paragliding only)
names the end point "Landing". Unsplit tours look as before.

## D5 — Map

Connector legs come in their own slot per leg, coloured by that leg's activities. A single-line
GPX track's gradient switches at the line progress of the vertex nearest the goal; a multi-line
track keeps the union bands.

## D6 — Suggestions

`tour_field_value('tour_type')` stays the plain array for an unsplit tour (pending suggestions
stay fresh) and becomes `{types, ascent, descent}` for a split one. Apply accepts both; an array
on a split tour keeps the legs only if they still match (D2).
