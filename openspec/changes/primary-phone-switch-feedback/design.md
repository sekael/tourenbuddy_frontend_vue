# Design

## Context

Phone rows render primary-first via `orderedPhoneMethods`; the store swaps `isPrimary` and the computed reorders on the next render. Each phone renders two siblings (row + optional inline remove confirmation) inside a `<template v-for>`.

## Goals / Non-Goals

**Goals:** make the reorder visible, make the primary row unmistakable, remove the no-op action.

**Non-Goals:** the create form (`contact-form.vue`) — it never reorders rows; changing the store or ordering rules.

## Decisions

- **Vue `<TransitionGroup>` move transition (FLIP)** over hand-rolled animation: native to Vue, animates only `transform`, zero JS. Each phone's row + confirm are wrapped in one keyed element so the group has one child per method. Duration 700 ms (`PRIMARY_MOVE_MS`) with `--motion-ease-emphasized` — deliberately slower than the UI default so the eye can follow the number to the top.
- **Staged switch (`usePrimarySwitchSequence`):** the highlight and the list order are not read straight off `isPrimary`; the composable stages them behind a target primary id — highlight off → wait fade (320 ms) → order switches → wait move (700 ms) → highlight on. A newer target mid-sequence restarts from the current state (a revert before the move skips it). The durations live in JS (they time the steps) and reach the CSS as `--phone-fade` / `--phone-move`, so the two cannot drift. The moving promoted row gets `z-index: 1` so it crosses over the row it displaces.
- **Start on tap, not on save:** the target is the tapped phone (`pendingPrimaryId`) until the store's primary catches up, else the store's primary. The online save waits for the RPC (seconds on the free tier); starting on the tap gives instant feedback. A failed save clears the pending id, so the same sequence plays back to the old primary.
- **Reduced motion:** `.phone-move` transition disabled under `prefers-reduced-motion: reduce`, and the sequence switches highlight and order at once.
- **Highlight only with >1 phone:** a single phone is trivially primary; highlighting it is noise. Soft treatment: 6% primary tint (background plus a 4px spread shadow) and a 1px outline at 30% primary offset to the tint's edge. The hairline is an `outline`, not a second shadow ring: a ring under the translucent tint shows through it as one thick band.
- **Inert star:** primary star renders as `<span>` (same as view mode) in edit mode; tooltip kept ("Primary phone") for clarity.

## Risks / Trade-offs

- [Wrapper element changes flex gap layout] → wrapper is a column flex container with the same `--spacing-sm` gap.
- [Move animation during an in-flight inline remove confirmation] → confirm sits inside the same wrapper, so it travels with its row.
