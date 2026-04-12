## Context

The app recently gained a responsive overlay system where `BottomSheet` renders as a centered dialog on desktop (>=600px). However, the `TourInfoSheet` is a special case — it needs to keep the map visible so users can see the selected tour marker and, in the future, GPX tracks. A centered dialog obscures the map center, which defeats the purpose of a map-centric tour viewer.

The `tour-creation-dialog.vue` already implements its own dual rendering pattern. We follow a similar approach: `TourInfoSheet` conditionally renders a `SideDrawer` on desktop and a `BottomSheet` on mobile.

## Goals / Non-Goals

**Goals:**

- Provide a `SideDrawer` component that anchors to the right edge on desktop, keeping the map visible
- `TourInfoSheet` uses `SideDrawer` on desktop, `BottomSheet` on mobile
- Camera fly-to offsets account for the drawer width on desktop (right padding)
- Mobile experience is completely unchanged

**Non-Goals:**

- Changing any other sheet consumer (feedback, profile, contact) — they keep using centered dialogs
- Making `SideDrawer` draggable or resizable
- Adding a backdrop/scrim behind the drawer (the map should remain interactive)
- Changing `BottomSheet` component in any way

## Decisions

### 1. New `SideDrawer` component vs. modifying `BottomSheet`

**Decision:** Create a new `src/core/components/side-drawer.vue` component rather than adding a "drawer mode" to `BottomSheet`.

**Rationale:** The drawer has fundamentally different layout (right-anchored, full height, no backdrop) compared to the centered dialog. Mixing both modes into `BottomSheet` would add complexity and risk breaking the existing centered dialog behavior for other consumers.

**Alternative considered:** Adding a `variant="drawer"` prop to `BottomSheet` — rejected because the visual and behavioral differences are too large for a single component.

### 2. Conditional rendering in `TourInfoSheet`

**Decision:** `TourInfoSheet` uses the `useIsDesktop` composable to conditionally render `<SideDrawer>` on desktop and `<BottomSheet>` on mobile. Both receive the same slot content and props.

**Rationale:** Keeps the decision at the consumer level. Other sheets that work fine as centered dialogs don't need to know about `SideDrawer` at all.

### 3. Drawer width and positioning

**Decision:** Fixed width of 400px, anchored to the right edge with `position: fixed; top: 0; right: 0; height: 100vh`. Uses `z-index: 50` to sit above the map but below any potential modals.

**Rationale:** 400px provides enough space for tour details while leaving the majority of the map visible on typical desktop viewports (1024px+). Fixed positioning ensures it overlays the map correctly regardless of parent layout.

### 4. Camera offset with right padding

**Decision:** On desktop, the `flyTo` call uses `padding: { right: 400 }` (matching drawer width) instead of the previous `{ bottom: 0 }`. On mobile, behavior stays the same with bottom padding.

**Rationale:** Right padding shifts the effective map center to the left, keeping the tour marker visible and centered in the remaining map area beside the drawer.

### 5. Transition handling for tour info on desktop

**Decision:** The tour info sheet container on desktop uses a `slide-drawer` transition (`translateX(100%)`) instead of the shared `sheet` transition. On mobile, it continues using the existing `sheet` transition (slide-up).

**Rationale:** The slide-from-right animation matches the drawer's anchored position. The existing sheet transition (slide-up on mobile, fade on desktop) doesn't make sense for a right-edge drawer.

### 6. No backdrop on desktop

**Decision:** The `SideDrawer` does not render a backdrop scrim on desktop. Dismissal is handled by `map-page.vue`'s existing `handleMapBackgroundClick`.

**Rationale:** The whole point of the drawer is to keep the map visible and interactive. A scrim would darken the map and defeat the purpose.

## Risks / Trade-offs

- **Narrow viewports (600-800px):** A 400px drawer takes up half the screen. This is acceptable for now since the app is mobile-first and true desktop usage starts at ~1024px. The 600-800px range is tablet territory where the bottom sheet (mobile) still applies.
  - Mitigation: The 600px breakpoint already handles this — below 600px the bottom sheet renders instead.

- **Two wrapper components for `TourInfoSheet`:** The conditional `SideDrawer` / `BottomSheet` adds a small amount of complexity to `TourInfoSheet`.
  - Mitigation: The pattern is straightforward and well-precedented by `tour-creation-dialog.vue`.

## Open Questions

None — the approach follows established patterns in the codebase.
