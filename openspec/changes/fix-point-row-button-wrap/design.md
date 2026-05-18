## Context

`.point-row` in `src/features/tours/presentation/components/tour-form.vue` is a flex row containing one or more `.pick-btn` controls. `.pick-btn` sets `white-space: nowrap` to keep icon+label on one line. The row has no `flex-wrap` rule, so on narrow viewports (iPhone 15 PWA reported in #149) two pick buttons overflow the bounded `.point-section`.

Issue #149 also asks to audit other places in the app for the same pattern (button groups that may exceed their container).

## Goals / Non-Goals

**Goals:**
- Pick-button rows in the tour form remain visually contained within `.point-section` on the narrowest supported viewport (~320 CSS px).
- Same wrap behavior applied wherever a confirmed overflow exists in audited components.

**Non-Goals:**
- Restyling the buttons themselves (size, icon, label).
- Changing labels or translations to fit on one line.
- Wholesale redesign of any sheet/dialog layout.

## Decisions

- **Wrap with `flex-wrap: wrap` + `row-gap`** on `.point-row` rather than shrinking buttons.
  - Rationale: preserves tap-target size (a11y), keeps labels legible, smallest possible diff.
  - Alternative considered: remove `white-space: nowrap` and let labels break — produces ugly two-line labels mid-word and looks worse than wrapping the whole button.
  - Alternative considered: hide one button into a menu on narrow viewports — overkill for a CSS layout bug.
- **Audit scope limited to confirmed overflow.** Run a quick visual/manual check (320 px width) on the components listed in the proposal Impact section. Only fix containers that actually overflow; do not pre-emptively add `flex-wrap` everywhere — risk of altering established layouts.

## Risks / Trade-offs

- [Buttons wrap to two lines on narrow viewports, slightly increasing form height] → acceptable; the form is in a scrollable sheet.
- [Audit may surface other overflow spots out of scope for #149] → if found, fix the obvious ones inline; defer larger redesigns to a separate change with a note in the PR description.
