## Why

Users currently have no way to discover other TouringBuddy users among their contacts. Friendship connections are a prerequisite for upcoming social features (planned-tour visibility, friend notifications). Linking via verified phone numbers reuses existing trust signal (SMS verification) so connection requests cannot be forged from arbitrary contacts.

## What Changes

- New friendship domain: friendship requests, accepted friendships, denied requests
- When a verified user adds a contact (manual or vCard import) whose phone matches a verified user account, prompt to send a friend request
- "Add as friend" optional — user can always save the contact without sending a request
- Recipient receives the request and can accept or deny; deny does not block keeping the contact
- Accepted friendships render a friendship icon next to the contact in the contacts list
- Phone-number lookup for matching is gated: BOTH parties must have verified phone numbers; unverified numbers are never discoverable and never matched
- Backend: Supabase tables for friendships and friend requests with RLS enforcing verified-phone gating; a discovery RPC that returns whether a given phone number belongs to a verified user (without leaking identity beyond confirmation)
- Security UX: phone verification flow shows an explicit, acknowledge-required notice describing discoverability consequences before sending the OTP; connect prompt and friend-requests inbox surface the user's right to deny any request without justification; Accept and Deny actions visually balanced (no dark patterns)
- vCard file import constrained to a single `.vcf` file per invocation (file picker no longer multi-select; composable rejects multi-file input). Multiple vCard blocks within the file remain supported

## Capabilities

### New Capabilities

- `friendships`: friendship request lifecycle (send, accept, deny, list), data model, RLS policies, store, UI surfaces
- `contact-account-linking`: phone-number-based discovery flow during contact add/import, prompts, friendship-icon display in contact list

### Modified Capabilities

- `contacts`: contacts store exposes friendship status per contact; list row renders friendship icon when linked
- `contact-device-import`: import-results flow surfaces "matching TouringBuddy user" prompt per matched row
- `phone-verification`: verified phone numbers become discoverable to other verified users (privacy-relevant change to verification semantics)

## Impact

- DB: new tables `friendships`, `friend_requests`; new RPC `find_user_by_phone` (verified-only); RLS policies
- Frontend: new `features/friendships/` (full DDD), modifications to `features/contacts/` presentation + store, modifications to import-results component
- Auth/profile: no changes to verification flow itself, but verified phone semantics expand
- i18n: new keys for prompts, request notifications, accept/deny actions in `en.json` and `de-CH.json`
- Out of scope (future stories): friend tour visibility, friend notifications on tour updates, real-time push for incoming requests
