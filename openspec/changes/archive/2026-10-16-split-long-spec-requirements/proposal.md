# Proposal

## Why

`openspec validate --strict` flags 167 requirements whose description exceeds 500 characters. Most of them never change, but eight are the most-edited requirements in the project (3–5 edits each across the archived changes), and they keep growing: every edit to an existing requirement re-copies its whole block. Long blocks bundle several rules, make it hard to tell which scenario covers which rule, and let two in-flight changes that edit the same block silently overwrite each other on archive. This change splits exactly those eight, so their future edits are small and isolated.

## What Changes

- Split eight requirements into one requirement per behavior (8 → 44), each description at most 500 characters:
  - `notifications`: "Notification preference channels" (→ 11; one requirement per mutable type)
  - `contact-device-import`: "vCard file import" (→ 5), "Import contacts via Contact Picker API" (→ 3)
  - `onboarding-tour`: "Guided step sequence" (→ 7)
  - `shared-tour-notifications`: "Meaningful-edit filtering" (→ 5)
  - `auth`: "Auth store manages session state" (→ 6), "Auth gate redirects based on session state" (→ 4)
  - `map-integration`: "Map action overlay with FABs" (→ 3)
- Every existing scenario is kept verbatim and placed under the requirement whose rule it tests. No new scenarios, no behavior changes.
- The core part of each split gets a new name (e.g. "Guided step sequence" → "Guided step order"), because OpenSpec only allows this restructure as REMOVED + ADDED and rejects re-adding a removed name.

Out of scope:

- The other 159 long requirements; they have never been edited and are split only if one starts causing friction.
- Spec content that no longer matches the app. Found while splitting, kept verbatim here (a split must not change meaning), to be fixed in a separate change. In `map-integration`, "Map action overlay with FABs" still describes a base-map *style picker* that unfolds styles beside its entry; "Map layers panel" (`map-trail-overlays`) and the app replaced it with a layers panel. It also says the speed-dial trigger is *disabled* while an overlay is open, but the app (`map-action-overlay.vue`) and `tour-action-bar` dismiss the overlay instead.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `auth`, `contact-device-import`, `map-integration`, `notifications`, `onboarding-tour`, `shared-tour-notifications`: requirement structure only; no requirement's behavior changes.

## Impact

- Six files under `openspec/specs/` change when the change is archived. No code, test, DB or i18n changes.
- `docs/reviews/code-review-2026-05-04.md` cites "Auth gate redirects based on session state" by name; it is a dated review and is left as written.
