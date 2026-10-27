## Context

The owner toggles row (`tour-info-sheet.vue`) is a wrapping flex row of two pills whose labels
change with state. Pill width followed the current label, so the wrap decision depended on the
state combination, not just on the available width.

## Decisions

**D1 — Reserve the other label's width in CSS.** Each label is an `inline-flex` column holding
its text plus a `::after { content: attr(data-alt) }` with zero height and `visibility: hidden`.
The column is as wide as the longer of the two labels, so a pill keeps its width when toggled
and the row wraps by width only. Rejected: rendering a hidden duplicate face (icon + label) in a
stacked grid cell — centres perfectly but doubles the markup and leaks the alternate text into
`textContent`. The `::after` keeps the DOM text and accessible name unchanged (hidden generated
content is excluded from the name). Trade-off: the shorter label sits left-aligned next to its
icon inside the reserved width, so that pill's content is a few pixels left of centre.

**D2 — Labels and padding sized from measured widths.** Measured in the app: a pill costs
icon 19 px + gap 8 px + padding, the row gap 8 px; available row width is 310 px at a 360 px
screen, 325 px at 375 px, 332 px in the desktop drawer. With `padding-inline: var(--spacing-sm)`
(chrome 110 px per row) the longest label pairs need 295 px (en) and 309 px (de-CH), so the row
is one line from 360 px in both locales; the spec promises it from 375 px, where de-CH has 16 px
slack. Below that both pills stack at full width in every state.

**D3 — Keep action-style labels.** The 2026-10-20 review rejected state-only chips because they
did not read as "complete" / "make private", so the labels stay actions, just shorter: en
"Make private" / "Make visible", de-CH "Abschliessen", "Privat machen" / "Freigeben".
`completedBtn` is unchanged (it also labels the friend-facing status pill).
