# Design

## Context

See proposal.md. Ground truth is the app: `use-map-overlay.ts` (menu entries, `layers` icon for map layers), `map-action-overlay.vue` (trigger hidden while picking a location or drawing a region; while an overlay is active it is dimmed and a tap emits `dismissOverlay`, which `map-page.vue` handles with `closeOverlay`), `map-layers-panel.vue` / `layer-tile.vue` (preview tiles).

## Goals / Non-Goals

**Goals:** remove every statement about the replaced style picker and the "disabled" trigger that contradicts the app.

**Non-Goals:** other spec drift; splitting the still-long "Documented exceptions" requirement (MODIFIED keeps its text whole apart from the corrected bullet).

## Decisions

- **Replace, not modify, "Speed-dial entries and order".** Its stale scenario "Style picker button" must go, and OpenSpec rejects a MODIFIED block that drops a scenario; REMOVED + ADDED under "Speed-dial menu entries and order" keeps the two accurate scenarios verbatim and adds "Map layers entry".
- **Remove "Base map picker styling" outright.** Its replacement is already specified ("Map layers panel" in `map-trail-overlays`); restating it here would create a second source for the same rule.
- **Trigger requirement points at `tour-action-bar`.** "Single active top-level interaction" already owns the dimmed-but-dismissing behavior; `map-integration` keeps its scenarios (incl. hidden states) and references that requirement for the rule.

## Risks / Trade-offs

- [Requirement renamed again, two changes after the split created it] → nothing references "Speed-dial entries and order" outside the archived split change.
