## Why

The owner toggles below the tour detail hero (complete / make private) wrapped differently
depending on their state: each label changes with its state ("Complete Tour" ↔ "Completed",
"Make tour private" ↔ "Make tour visible to friends"), so the pills changed width and the
row jumped between one and two lines — one line when only completed, two lines when neither
or both. The long visibility labels also forced two lines on most phones.

## What Changes

- Each toggle reserves the width of its other state's label (hidden, zero-height), so the row
  wraps the same way in all four state combinations.
- Shorter labels so the row fits one line on phones: en "Make private" / "Make visible", de-CH
  "Abschliessen", "Privat machen" / "Freigeben"; the toggles use a slightly smaller horizontal
  padding. Below that width both toggles stack at full width, in every state.

## Capabilities

### Modified Capabilities

- `tour-info-extended`: owner toggles keep one layout in every state.

## Impact

`tour-info-sheet.vue` (template + scoped CSS), `en.json` / `de-CH.json` label values. No API,
store or DB change.
