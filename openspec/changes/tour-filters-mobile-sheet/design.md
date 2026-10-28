# Design

## D1 — In-flow view, not an overlay

The overlay was `position: absolute` inside the list region, so its height was the filtered rows'
height: one match left one row of panel. Clamping the region (the previous fix) only moved the
problem. Rendering the panel in place of the rows (`v-if` panel, `v-show` rows) makes the filter
groups the only content, so the sheet's own scroller is the only scroller and no selection can
change the panel's size. Rows stay mounted, so the desktop list keeps its scroll position.

## D2 — Sheet sizing while filtering

On a phone the list sheet is `fitContent + resizable` (opening ≤ 40%, full ≤ 70%). While the
filters are open it drops `resizable`, so the fit-content defaults apply: opening ≤ 70%, a handle
up to 90%. Closing restores the browse snaps. The hold stays on while filters or search are
active, so the sheet never sinks when a selection thins the list.

## D3 — Held sheets drag to full snaps

`holdHeight` kept the sheet from shrinking, but drags and snap keys were still capped by the
(shrunken) content, so a narrowed list refused to be dragged up. While held, user-initiated
moves use uncapped snap heights; refits on content changes keep their caps. A tap on the handle
restores the exact height it started from.

## D4 — Footer instead of pinned summary + outside dismissal

The pinned summary row overlapped chips and intercepted taps; the pointer-outside rule closed
the panel on a handle drag. The footer holds Reset and "Show N tours" (N = rows on close, an
outing counted once). Dismissal: the trigger, "Show N tours", Escape.

## D5 — Additive grades

`gradeRanges` becomes `grades: Set<string>`; a tour passes when any part's leading scale grade is
selected. Modifier rules unchanged (ZS+ is ZS, free text never matches).
