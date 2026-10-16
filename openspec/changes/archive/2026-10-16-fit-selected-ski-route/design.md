# Design

## Context

`map-page.vue` watches the trail card's candidates and selection. On each change it waits for the sheet to settle (one tick; on mobile two animation frames, so the sheet has refit and published its resting height), builds the bounds of the highlighted geometry (all candidates, or the chosen route) and calls `frameBounds` only when `isBoundsVisible` reports a corner outside the free map area. `frameBounds` uses `map.cameraForBounds` with padding = margin + covered area (sheet inset or drawer width), capped at `TOUR_ZOOM` (12). Motivation: see proposal.md.

## Goals / Non-Goals

**Goals:**

- A route chosen from the list is always framed, zooming in past the tour zoom when it is short.

**Non-Goals:**

- No change to framing for the list itself, a single-route lookup, going back to the list, or tour framing.
- No new camera animation; the existing 1 s `flyTo` is reused.

## Decisions

### Recognise a choice by the card's own "from list" rule

A lookup with exactly one hit opens straight on its details; with several it opens the list and nothing is selected. So "a route is selected and the card holds more than one candidate" means the user chose it from the list. That is the same rule the card already uses to show its back control. The watcher evaluates it from the card state *after* its waits, so a back tap during them frames the list by the normal rule instead.

Alternatives: comparing old and new candidate arrays by reference in the watcher (couples the page to how the store copies the card, and is evaluated before the waits); a `pickedFromList` flag in the store (extra state for something the card already implies). Both rejected.

### Reuse `frameBounds` with a per-call max zoom

`cameraForBounds` with per-call padding already centres the bounds in the padded area and picks the largest zoom at which everything fits. That is exactly "fill the remaining space without cutting anything off". Only the cap changes: `frameBounds` takes an options object `{ fallbackCenter?, maxZoom? }` (default `TOUR_ZOOM`) and a choice passes `ROUTE_ZOOM = 15`. At zoom 15 a phone-width map shows about 1 km, so short routes fill the space while a near-point geometry does not dive to street level. Both trail overlays serve tiles beyond 15 (max 17/18).

### Fallback without room stays at the tour zoom

When the padding leaves no room to frame in, `cameraForBounds` returns nothing and `frameBounds` centres on the fallback. That fallback zoom is `min(maxZoom, TOUR_ZOOM)`: centring a long route at zoom 15 would show only its middle.

## Risks / Trade-offs

- [Mobile sheet changes height between list and details, framing could use a stale inset] → the watcher waits two animation frames, after which the sheet has refit and published its new resting height (same wait the details framing already relied on).
- [Tiny free area, e.g. landscape phone with a tall card: nothing fits] → centre on the route at zoom ≤ 12 (see fallback decision); the route may still be cut off there, unavoidably.
- [Choosing a long route zooms out] → intended: nothing is cut off.
