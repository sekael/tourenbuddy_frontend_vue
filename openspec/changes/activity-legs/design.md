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
activity. Untouched lines follow the default (paragliding with others: down, the rest up; hiking
with a bike: the bike down — hike & bike is carried up, ridden down; otherwise both); a tapped
line is the user's. Every line "both" is no split. A way that would empty a leg is disabled, so the
form never saves something other than it shows; choices outlive their activity (removed and added
back, it keeps its way), and a removal that empties a leg falls back to the defaults, visibly.
A lone glider gets one line with Down (to the launch on foot or by lift — unsplit) and Both
(flown from the start in thermals — legs glider/glider, read as one activity in the type row).
Start and end show their distance from the goal, as a warning past 20 km — a search hit in the
wrong valley (a commune centre as the landing) stands out.

## D4 — Display

Split tours list the way-up activities after "↑" and the way-down ones after "↓" (detail type
row, stage card meta), and order the activity disc up-first — in the list too, where a
multi-activity tour shows the detail's disc. A way down that includes paragliding names the end
point "Landing". Route numbers sit in the detail hero beside the date (the sheet's opening height
shows them); a flown way keeps its arrow and adds its activities' icons, the glider last — the
glider alone for a pure flight (a flown descent is the flight's net drop), ski + glider for a
shared one, so neither passes for the other. Mountain biking wears
its own violet, so a hike & bike's legs tell apart on the map. Unsplit tours look as before.

## D5 — Map

Connector legs come in their own slot per leg, coloured by that leg's activities. A single-line
GPX track's gradient switches at the line progress of the vertex nearest the goal; a multi-line
track keeps the union bands.

## D6 — Suggestions

`tour_field_value('tour_type')` stays the plain array for an unsplit tour (pending suggestions
stay fresh) and becomes `{types, ascent, descent}` for a split one. Apply accepts both; an array
on a split tour keeps the legs only if they still match (D2).
