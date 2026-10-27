## Context

Start and end are independent columns; neither the database nor the write RPCs couple them.
The "end needs a start" rule lived only in the client: the form gating
(`2026-05-04-tour-form-point-gating`), and three presentation guards that returned nothing for a
tour without a start (map connector, open tour's detail markers, info sheet route rows). Since
`smarter-tour-creation` D8, "Connect" writes exactly that state, and the form already shows an
end set without a start.

## Goals / Non-Goals

**Goals:** every place that shows a tour's end shows it whether or not a start is set, and the
route numbers count every rise and drop over the legs the tour has.

**Non-Goals:**

- Offering an end before a start in a fresh form: creation stays start-first.
- Outing overview markers, gaps and the timeline already handle a missing start; unchanged.

## Decisions

- **Connector without a start = the way down only.** The leg goal → end is drawn with a one-way
  arrow; a round trip needs a start to be one, so no two-way arrow. A split tour's remaining leg
  keeps its way-down colours. Alternative — draw nothing until a start exists — is the bug.
- **Removing the start keeps the end.** The cascade was justified by "an end without a start is
  meaningless"; now that it is valid, the cascade only destroys data (a connected stage loses its
  connection and the gap reappears). Alternative — cascade only for a round trip (end = start) —
  saves one tap in a rare case at the cost of a second rule; not taken.
- **Most accurate data first (owner's rule): GPX track with heights > point heights > nothing.**
  A track with heights counts every rise and drop along it, a split tour's too. The exception is
  a way flown whole (hike & fly, a lone glider's way down saved unsplit, a thermal flight up):
  walked ways count every rise and drop, a flown way only its net change — a thermal is not
  legwork — and the distance is the walked way's, none for a day flown both ways (a flight's
  line is not legwork either). Before, a split track
  counted the climb on the way up only and the descent on the way down only, and a lone glider's
  unsplit track counted its thermals. A way flown only in part counts the whole track, thermals
  included: the track doesn't say where the flight starts.
- **Point heights over the legs that exist (owner's rule).** The legs are start → goal and
  goal → end; each needs both heights. Every rise counts as climb and every drop as descent,
  whichever leg it is on — both numbers gauge fitness, so a leg running the other way (goal below
  the start, end above the goal) still counts. Without a start the start → goal leg is absent,
  without an end the goal → end leg; an absent leg, or one missing a height, adds nothing and the
  other still counts. Before, a missing start or height blanked both numbers, so a connected stage
  showed no descent. A 0 does not show ("↓ 0 m" says nothing).
- **Outing totals add up what the segments know (owner's rule).** Before, one segment without a
  number withheld that total. The same rule covers the distance: segments with a track add theirs.

## Risks / Trade-offs

- [Removing the start of a round trip leaves its end where the start was] → the end row stays
  visible with its own remove button; one more tap clears it.
- [A leg whose height failed to load is left out, so the numbers and the outing totals can read
  low] → the height can be typed in the form; showing what is known beats showing nothing.
- [An outing's total distance counts only the segments with a track] → a segment without one has
  no distance to add; its card shows none either.
