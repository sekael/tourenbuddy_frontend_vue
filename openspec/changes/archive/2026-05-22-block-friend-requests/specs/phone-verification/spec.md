## ADDED Requirements

### Requirement: Discovery RPCs filter bidirectionally on active blocks

The bulk and name-lookup discovery RPCs — `find_users_by_phones`, `find_phones_by_user_ids`, and `get_user_names_by_ids` — MUST exclude rows identifying user B from the result whenever an active `user_blocks` row exists between B and the calling user A in EITHER direction (i.e. `(B, A)` or `(A, B)` with `unblocked_at IS NULL`). Filtering is bidirectional: a blocker also no longer sees the blocked user in these results. Implementation lives server-side inside the SECURITY DEFINER function bodies so it cannot be bypassed by a custom client.

The self-conflict pre-check RPCs — `find_user_by_phone` and `is_phone_registered` — are EXEMPT from the block filter. Both are used by the phone-verification flow to detect whether a phone the caller is about to claim is already taken. `is_phone_registered` returns only a boolean and leaks no identity. `find_user_by_phone` returns a uid but the uid is inert under the other block enforcement points (friend-request INSERT denied, name lookup filtered, bulk discovery filtered, `is_blocked_by` hides send affordance). Bypass is required because the auth layer's own collision check will reject the OTP send anyway — pre-check existing to avoid that confusing UX.

#### Scenario: find_user_by_phone exempt from block filter
- **WHEN** user A calls `find_user_by_phone(<B's verified phone>)` and an active `user_blocks` row exists between A and B in either direction
- **THEN** the RPC still returns B's uid (the pre-check is exempt; other block mechanisms remain enforced)

#### Scenario: is_phone_registered exempt from block filter
- **WHEN** user A calls `is_phone_registered(<B's verified phone>)` and an active `user_blocks` row exists between A and B in either direction
- **THEN** the RPC still returns `true` (pre-check exemption)

#### Scenario: find_users_by_phones omits blockers
- **WHEN** user A calls `find_users_by_phones([<various phones>])` and one of the phones belongs to user B who has actively blocked A
- **THEN** the result set MUST NOT contain B's user id; other matches are returned normally

#### Scenario: find_phones_by_user_ids omits blockers
- **WHEN** user A calls `find_phones_by_user_ids([..., B, ...])` and an active `user_blocks` row exists between A and B in either direction
- **THEN** the result set MUST NOT contain B's row

#### Scenario: get_user_names_by_ids omits blockers
- **WHEN** user A calls `get_user_names_by_ids([..., B, ...])` and an active `user_blocks` row exists between A and B in either direction
- **THEN** the result set MUST NOT contain B's name row

#### Scenario: Phone-conflict pre-check unaffected for caller's own number
- **WHEN** user A invokes phone verification and `find_user_by_phone` is called for A's own number
- **THEN** the filter does not apply (a user cannot block themselves; the existing self-match path is preserved)
