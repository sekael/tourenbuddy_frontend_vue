## Why

On narrow mobile viewports (e.g. iPhone 15 PWA), the end-point action buttons in the tour form ("Add End Point" + "Round Trip" / "Rundtour") overflow the dark bounded `.point-section` container. Cause: `.point-row` is a non-wrapping flex container holding `.pick-btn` children with `white-space: nowrap`. Reported in issue #149 with screenshot.

## What Changes

- Allow `.point-row` button groups in `tour-form.vue` to wrap onto multiple lines when their combined intrinsic width exceeds the container, so action buttons stay within the bounded section across all viewports.
- Audit other comparable button rows across the app (contacts, friendships, map, tour-list-row) and apply the same wrap-on-overflow behavior where containers are at real overflow risk.
- No behavioral, copy, or routing changes. Visual-only fix.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tour-form-extended`: clarify that point-picker action rows must remain within their bounded `.point-section` container across viewport widths (wrap on overflow).

## Impact

- `src/features/tours/presentation/components/tour-form.vue` — CSS only (`.point-row` flex-wrap).
- Possible minor CSS adjustments in audited components if overflow is confirmed.
- No DB, API, i18n, or routing impact.
