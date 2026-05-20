## Why

Friend request and friendship state currently only updates on page reload. Recipients miss incoming requests (#136), senders miss accept/decline outcomes, and friendship icons linger after the other party deletes their contact (#138 — DB triggers already remove the row, but UI keeps the icon). Web Push (#112) is opt-in and cannot be the canonical source of in-app reactivity.

## What Changes

- Introduce a reusable realtime primitive at `src/core/realtime/use-realtime-subscription.ts` — a generic composable that, given a set of `postgres_changes` bindings, a debounced refetch callback, and an auth-gating `enabled` ref, manages the channel lifecycle (subscribe on enable, `removeChannel` on disable / hot-reload / app teardown, single per-key channel registry to dedupe). This becomes the canonical pattern for any feature that needs server-pushed UI sync (tours, contacts, future capabilities).
- Apply that primitive in `friendshipsStore` as the proof-of-concept: bindings for `friend_requests` (filtered by `to_user_id` and `from_user_id`) and `friendships` (filtered by `request_user_id` and `response_user_id`), refetch hook delegating to existing `fetchAll`, enabled when `authenticated && phoneVerified`.
- Enable Realtime replication for `friend_requests` and `friendships` via a new migration adding both tables to the `supabase_realtime` publication. RLS already restricts visibility per user — Realtime honors RLS, no policy widening.
- Existing notification dispatch (push + email) is left untouched. Realtime is a parallel UI-only channel; the primitive contractually forbids notification dispatch from within event handlers (enforced by convention + test).
- No change to schema or DB cleanup logic — the trigger-based cleanup from `20260519185500_cleanup_friend_requests_and_friendships_on_link_break.sql` already removes the friendship when one side deletes the contact; this change makes the UI reflect that removal in real time, closing #138.
- Document the primitive's intended reuse for the `tours` feature (and others) in `design.md` with a worked example, so the next feature lands with minimal incremental code.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `friendships`: add requirements for realtime UI reactivity on `friend_requests` and `friendships` events; constrain that Realtime is a UI-sync channel and never gates notifications.

## Impact

- `src/core/realtime/use-realtime-subscription.ts` — new generic primitive (channel registry, debounced refetch, auth-gated enable).
- `src/features/friendships/presentation/stores/friendships-store.ts` — consume primitive, define bindings + refetch.
- `supabase/migrations/<new>_realtime_friendships.sql` — `alter publication supabase_realtime add table …` (idempotent).
- `test/core/realtime/` — primitive unit tests (lifecycle, dedupe, debounce, no-notify invariant).
- `test/features/friendships/` — integration test that store wiring calls the primitive correctly.
- No change to `notifications` capability, `notify-dispatch`, or the email-hook worker.
- No change to `contacts` capability — #138 is resolved purely by reacting to the existing DB-level `friendships` DELETE event.
- Future: `tours` feature can adopt the primitive with ~10 lines (bindings + refetch) — no further plumbing.
