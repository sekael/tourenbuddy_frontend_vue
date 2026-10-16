# Design

## Context

Phone rows render primary-first via `orderedPhoneMethods`; the store swaps `isPrimary` and the computed reorders on the next render. Each phone renders two siblings (row + optional inline remove confirmation) inside a `<template v-for>`.

## Goals / Non-Goals

**Goals:** make the reorder visible, make the primary row unmistakable, remove the no-op action.

**Non-Goals:** the create form (`contact-form.vue`) — it never reorders rows; changing the store or ordering rules.

## Decisions

- **Vue `<TransitionGroup>` move transition (FLIP)** over hand-rolled animation: native to Vue, animates only `transform`, zero JS. Each phone's row + confirm are wrapped in one keyed element so the group has one child per method. Duration `--motion-duration-long` ×1.5 (~700 ms) with `--motion-ease-emphasized` — deliberately slower than the UI default so the eye can follow the number to the top.
- **Reduced motion:** `.phone-move` transition disabled under `prefers-reduced-motion: reduce`; the highlight alone still conveys the change.
- **Highlight only with >1 phone:** a single phone is trivially primary; highlighting it is noise. Tint uses `color-mix(var(--color-primary) 8%)` + 1.5px primary border, the same treatment as selected tiles elsewhere in this component; colour transitions so the new primary fades in while moving.
- **Inert star:** primary star renders as `<span>` (same as view mode) in edit mode; tooltip kept ("Primary phone") for clarity.

## Risks / Trade-offs

- [Wrapper element changes flex gap layout] → wrapper is a column flex container with the same `--spacing-sm` gap.
- [Move animation during an in-flight inline remove confirmation] → confirm sits inside the same wrapper, so it travels with its row.
