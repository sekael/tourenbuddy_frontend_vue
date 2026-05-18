## Context

`notification-preferences-section.vue` renders the push row with one of three states: a toggle switch (push supported and permission grantable), an inline `installHint` (PWA must be installed first), or an inline `deniedHint` (permission denied). On narrow viewports the long full-sentence German hints wrap onto multiple lines, crowding the row and producing the layout glitch shown in issue #151.

A touch-aware `base-tooltip` component already exists at `src/core/components/base-tooltip.vue` (tap-to-toggle with outside-click + timeout dismissal). Reusing it avoids new infra.

## Goals / Non-Goals

**Goals:**
- Mobile layout for the push row stays single-line regardless of locale.
- Full explanation text remains discoverable via tap.
- Works on touch and pointer devices without separate code paths.
- Zero changes to push capability detection, store, or backend.

**Non-Goals:**
- Redesign of the whole notifications section.
- Localization changes to the underlying hint strings (`installHint` / `deniedHint`).
- Replacing `base-tooltip` or adding a popover primitive.

## Decisions

### Use compact badge + info-icon-triggered tooltip
Replace inline hint text with: a small "Not available" label and a Material Symbols `info` icon button wrapped in `<BaseTooltip :text="hintText">`. Tooltip body = existing `installHint` or `deniedHint` string.

- Alternatives considered:
  - **Truncate hint with ellipsis** — content loss without explicit affordance to expand.
  - **Move hint to a row below as second line** — still wraps; doubles row height.
  - **Custom popover** — `base-tooltip` already covers tap + outside-dismiss; no need for new component.

### Single visual treatment for both unavailable states
Both `requiresPwaInstall` and `pushDenied` use the same compact badge; only the tooltip body and (for denied) a warning color on the icon differ. Keeps mental model simple.

### New i18n key `notifications.pushUnavailable`
Short label "Not available" / "Nicht verfügbar" used as the badge text. Existing `installHint` / `deniedHint` keys are kept intact and reused as tooltip bodies — no duplicate translations.

### Accessibility
- The info icon is a `<button>` (not a `<span>`) with `aria-label` set to the same hint text, so screen readers announce the full explanation without depending on the tooltip's visual state.

## Risks / Trade-offs

- **Discoverability of the info affordance** → Mitigation: use the standard `info` Material Symbol at full opacity; the badge text "Not available" sits adjacent so the icon is contextual, not isolated.
- **Tooltip positioning on very small viewports** → Mitigation: `base-tooltip` already clamps horizontal position to the viewport with edge padding; flips above/below based on row position.
- **Pointer-device users lose hover-only reveal**: Not a real regression — `base-tooltip` shows on hover for pointer devices and on tap for touch.
