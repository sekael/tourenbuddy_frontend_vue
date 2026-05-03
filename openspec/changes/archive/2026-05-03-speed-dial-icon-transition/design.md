## Context

`speed-dial-trigger.vue` renders a single `add` Material Symbol that rotates 45° when open. The rotation approximates a close icon but is visually ambiguous and inconsistent with the rest of the app's icon usage.

## Goals / Non-Goals

**Goals:**

- Replace `add` icon with `menu` (closed) and `close` (opened) Material Symbols
- Cross-fade between icons using CSS opacity transition
- Remove existing rotation transform

**Non-Goals:**

- Changing any prop, emit, or accessibility attribute
- Animating the icon position or size
- Updating any other component

## Decisions

**Cross-fade via absolute positioning**
Both icons are rendered simultaneously. The active icon has `opacity: 1`, the inactive has `opacity: 0`. Both transition on `opacity`. This avoids DOM re-insertion flicker and keeps the transition purely CSS-driven.

Alternative considered: `v-if` / `v-else` with Vue `<Transition>` — requires leave+enter coordination and is heavier for a single-icon swap.

**Icon names**
`menu` (Material Symbols) for closed state, `close` for open state — both already available via the existing Material Symbols icon font; no new dependency.

## Risks / Trade-offs

- [Overlap during transition] Both icons occupy same space during fade — mitigated by absolute positioning within a fixed-size container (same 52×52 FAB).
