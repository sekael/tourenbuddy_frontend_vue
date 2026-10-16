# Design

## Context

See proposal.md for motivation. OpenSpec's validator rejects a MODIFIED requirement that omits any scenario the current block has ("archive refuses to drop them"), and rejects a delta that both REMOVES and ADDS the same requirement name.

## Goals / Non-Goals

**Goals:** each of the eight requirements becomes several requirements of at most 500 characters, one rule each, with every scenario under the rule it tests; the result is provably the same content.

**Non-Goals:** splitting the other long requirements; correcting stale content (see proposal.md, Out of scope); reordering the merged specs.

## Decisions

- **REMOVED + ADDED, not MODIFIED + ADDED.** A MODIFIED block must keep all of the original's scenarios, so the scenarios of the rules that move out would either stay under the wrong requirement or be duplicated. REMOVED (with Reason and Migration naming the new requirements) plus ADDED moves each scenario exactly once.
- **Core requirements are renamed** (the validator forbids re-adding a removed name): "Push and email notification channels", "vCard file parsing", "Guided step order", "Edit notifications only for partner-facing changes", "Auth store exposes session state and OTP actions", "Router guard redirects based on session state", "Contact Picker opens the native picker", "Speed-dial entries and order". No spec or code references the old names.
- **Per-type requirements in `notifications`.** The six type definitions alone exceed 500 characters, and that requirement grew mostly by adding types; with one requirement per type, a new type is a plain ADDED requirement.
- **Wording.** Original sentences are kept; changes are limited to what the split forces:
  - Cross-references now name their target: "the collision scan defined below" → "…defined in "Collision scan after tour save""; "that guard" → "the `beforeEach` guard"; "any other route" → "any route without `meta.redirectIfAuth`".
  - Type definitions, previously parentheticals in one list, read "The `<type>` type SHALL cover …".
  - vCard: the preference-marker rule becomes "vCard preference marker", referenced as rule 1; rules CELL → HOME → WORK are one list item ("…includes `CELL`; failing that, `HOME`; failing that, `WORK`"), same order.
  - Onboarding: the step order lists names only; each step's target moves to "Guided step targets".
  - Meaningful-edit: the span endpoint rule and the non-partner-facing exclusions become their own requirements.
- **Placement.** Archive appends ADDED requirements at the end of each spec. Each split's pieces land together in reading order, so they are left there instead of being reordered by hand.
- **Verification.** `verify-split.py` (in this change) compares each merged spec against a base ref: identical scenario blocks as a multiset, all other requirements identical and in order, no duplicate names, the eight originals gone. A dry-run archive into a copy of `openspec/` passed: 6/6 specs OK, 8 long requirements fewer. The script fails when a scenario is deleted.

## Risks / Trade-offs

- [Another change edits one of the eight requirements and archives first; REMOVED + ADDED would drop that edit] → archive this change soon; run `verify-split.py` right after archiving, which fails on any such drift; re-derive the delta from the new base if it does.
- [Meaning drift in reworded sentences] → wording changes are listed above; a word-level diff per requirement showed only connective words and the named cross-references changing.
- [Renamed requirements break external links] → none in specs or code; one dated review doc keeps the old name.
