## Context

Three overlay shells host all scrollable content in the app:
- `bottom-sheet.vue` (mobile)
- `dialog-window.vue` (desktop)
- `side-drawer.vue` (contacts panel)

`AdaptiveOverlay` routes to bottom-sheet on mobile and dialog on desktop, so most user-visible scroll surfaces flow through these three. Currently `.content` / `.dialog-content` / scroll area have `overflow-y: auto` without reserved scrollbar gutter. On mobile WebKit + Android Chrome the floating overlay scrollbar paints over text/buttons. On desktop the scrollbar shifts layout when it appears/disappears.

## Goals / Non-Goals

**Goals:**
- Scrollbar never overlaps content in any overlay scroll region (mobile + desktop).
- No layout shift when content becomes scrollable on desktop.
- Thin, consistent scrollbar look across the three overlays.

**Non-Goals:**
- No new design tokens.
- No change to page-level scrolling outside overlays.
- No behavior change (drag, snap, focus, a11y untouched).

## Decisions

### Use `scrollbar-gutter: stable` + thin custom styling
Reserves a fixed gutter on browsers that honor it (Firefox, Chromium desktop). Combined with `scrollbar-width: thin` + `::-webkit-scrollbar { width: 6px }` gives a consistent thin track. Alternative considered: static `padding-right`. Rejected because it wastes space when no scroll is needed and still requires gutter logic for desktop.

### Add small `padding-right` fallback (`--spacing-xs`)
iOS Safari and Android Chrome use overlay scrollbars and ignore `scrollbar-gutter`. A small right padding inside the scroll container guarantees the overlay scrollbar sits over the padding, not over content. Chosen value: `--spacing-xs` (~4px) — minimum to clear the overlay thumb without making layout feel asymmetric.

### Apply identically to all three components
Same three CSS lines on each scroll container. Considered extracting a shared utility class in `theme/global.css`. Rejected: only three call sites, scoped styles keep each component self-contained.

## Risks / Trade-offs

- [Asymmetric padding: content has slightly more right padding than left] → Negligible visual impact at 4px; matches common app shells.
- [Older browsers ignore `scrollbar-gutter`] → Fallback `padding-right` covers them; thin scrollbar still applies via `::-webkit-scrollbar`.
- [Scrollbar styling on macOS with "show always" preference] → Already overlaps today; this change improves, not regresses.

## Migration Plan

Pure CSS, no migration. Ship in one PR. Manual smoke: user profile sheet, tour info sheet, contacts drawer, any dialog with long content — verify scrollbar sits in gutter, content edges are clear.
