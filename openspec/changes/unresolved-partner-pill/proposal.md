## Why

When a partner-friend opens a friend's tour, the partner roster only lists co-partners whose contact resolved to a confirmed-phone registered user. Partners the owner added as plain address-book contacts (no app account, or an unverified phone) silently vanish from the roster, so the viewer sees an incomplete picture and cannot tell that other people are along on the tour. Surfacing a count of these unresolvable partners restores that signal without exposing any identity.

## What Changes

- The friend-read path SHALL expose, to partner-viewers only, a count of partner contacts on the tour that do **not** resolve to a confirmed-phone registered user (the "unresolved" partners).
- The tour info sheet SHALL render a single generic pill reading "and X more" alongside the named partner chips, where X is that count, shown only when X ≥ 1.
- The count and pill SHALL be visible only to viewers who already see the partner names (`is_partner`); non-partner friends continue to see no partner information at all.
- New i18n key for the generic pill label (`en`, `de-CH`), pluralized.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `friend-tour-visibility`: the "Partner representation for friend viewers" requirement gains behavior — the friend-read view exposes an unresolved-partner count to partner-viewers, and that count is surfaced as a generic "and X more" pill.

## Impact

- **DB (migration, new file):** `friend_tours_view` gains an `unresolved_partner_count` column, gated to `is_partner` (0 otherwise). A new tour-scoped resolver (or inline subquery) counts `tour_partners` rows whose contact has no confirmed-phone registered user, mirroring the auth guard of `tour_partner_names`.
- **Data layer:** `friendTourRowSchema` gains `unresolved_partner_count` → `unresolvedPartnerCount`; `tourSchema` gains an optional `unresolvedPartnerCount`. `tourRowSchema` (own tours) unaffected.
- **Presentation:** `tour-info-sheet.vue` renders the pill in the existing friend-partner chips block.
- **i18n:** new pluralized key in `en.json` and `de-CH.json`.
- No change to own-tour reads, RLS row authorization, or non-partner gating.
