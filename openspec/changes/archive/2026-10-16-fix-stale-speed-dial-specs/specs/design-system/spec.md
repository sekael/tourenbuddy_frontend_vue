# Spec Delta

## MODIFIED Requirements

### Requirement: Documented exceptions to shared button components

The shared `Button` and `IconButton` components are the default for interactive controls. The system SHALL nonetheless permit the following controls to remain bespoke because they fill a **role** the shared components do not model. Each exception below is intentional and SHALL be treated as conformant; controls NOT listed here SHALL use the shared components.

- **Map overlay controls** — the speed-dial trigger and its entries (`speed-dial-trigger`, `speed-dial-item`, used by `map-speed-dial-menu`), the map layers panel's preview tiles (`layer-tile`, in `map-layers-panel`), and the compass-reset FAB (`map-action-overlay`). These are floating map overlays wearing the shared glass surface rather than the on-surface `Button`/`IconButton` palette so they stay legible over busy map tiles. They differ by role, not by accident. (The location picker's and region drawing's Cancel and Continue actions read fine as shared `Button`s, so they are **not** exempt.)
- **Persistent tour action bar** — `tour-action-bar` is a segmented pill overlay defined by its own capability spec (see `tour-action-bar`); it is not a `Button`/`IconButton` consumer.
- **Media tiles & viewer controls** — the icon controls and white-on-scrim colors in `tour-attachment-viewer` sit over arbitrary dark media and require overlay-specific contrast; the attachment thumbnail tiles (`tour-attachments-strip`) are image/PDF previews, not labelled actions. Both are media affordances, not `Button`/`IconButton` consumers.
- **Selector / toggle controls** — controls whose role is selection state rather than a discrete action MAY remain bespoke; they are not action buttons. Examples: the primary-phone star (`contact-form`, `contact-detail-view`), the add-method phone/email type selector (`contact-detail-view`), the language selector (`profile-overview`, a segmented control), the tour completion / visibility toggles (`tour-info-sheet`), and the multi-select filter chips (`tour-form`, `tour-filters-panel`).
- **Chips & compact pills** — pill-shaped labels (`contact-chip`, the linked-tour pills and `full-row` navigation list in `linked-with-section`, the friend-partner chips in `tour-info-sheet`) are a distinct compact affordance the design system does not yet model as a base component. They are styled from the shared chip tokens in place and SHALL be extracted into a shared `Chip` component at the next demand rather than forced into `Button` (which would make them read as rectangular buttons).
- **Settings rows** — the identity card and the setting rows in `profile-overview` are full-width navigation list items (icon, label over current value, chevron) on the card tint, not labelled actions; making them `Button`s would turn a list into a stack of buttons.
- **Snackbar inline dismiss** — `error-snackbar`'s dismiss is rendered against the snackbar's own colored surface and stays bespoke.

#### Scenario: Map overlay control stays bespoke

- **WHEN** a floating map overlay control (speed dial, base-map options, compass) is rendered
- **THEN** it uses the shared glass surface and is exempt from the `Button`/`IconButton` requirement

#### Scenario: New control defaults to a shared component

- **WHEN** a new interactive control is added that is not a documented exception above
- **THEN** it uses `Button` (with a text label) or `IconButton` (icon-only)
