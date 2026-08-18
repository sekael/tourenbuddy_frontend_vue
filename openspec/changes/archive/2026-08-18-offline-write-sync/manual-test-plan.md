# Manual Test Plan — offline-write-sync (#245)

Local, hands-on verification of the offline write queue + reconnect replay. Complements
the automated suite (1187 tests). Focus: the things unit tests can't prove — real
IndexedDB persistence across reloads, real reconnect timing, and the UI surfaces.

## 0. Setup

1. **Local Supabase with the new migrations:**
   ```
   supabase start
   supabase db reset      # re-runs all migrations incl. 20260811085649 / 100000 / 20260813000000
   ```
   Confirm no errors. `updated_at` columns + the `*_contact_full` RPCs must exist.
2. **Point the app at local:** `.env.local` → `VITE_SUPABASE_URL=http://127.0.0.1:54321`,
   `VITE_SUPABASE_ANON_KEY=<local anon key from \`supabase status\`>`.
3. `npm run dev`, sign in (email/OTP), verify a phone (friendship flows are phone-gated).
4. Seed a little data online first: 1–2 tours, 2 contacts, a friend (second account),
   some availability days. So you have rows to edit offline.

### How to go offline (important — read this)

The app's `isOnline` is driven by `navigator.onLine` + the `online`/`offline` window
events, with a HEAD probe every 5 s while offline that upgrades back to online.

- **Go offline:** DevTools → Network → **Offline** (the full throttle preset). This flips
  `navigator.onLine` to false and fires the `offline` event. The **offline pill**
  ("You're offline — showing saved data") appears within a moment.
- **Do NOT** use request-blocking on just Supabase URLs — that leaves `navigator.onLine`
  true, so the app thinks it's online and writes hit the network instead of queueing.
- **Go back online:** uncheck Offline. Either the `online` event or the 5 s probe upgrades
  `isOnline`; the pill disappears and the drain kicks off.

---

## 1. Core queue lifecycle (do this first — it exercises the whole path)

| Step | Action | Expected |
|---|---|---|
| 1 | Online, open a tour. Go **offline**. | Offline pill shows. |
| 2 | Edit the tour name, save. | UI updates immediately (optimistic). **"Saved offline — will sync"** toast. **Pending pill** shows "1 change waiting to sync". |
| 3 | Edit the SAME tour again (different name), save. | Still **1** pending (coalesced to one entry per entity), not 2. |
| 4 | **Reload the app while still offline.** | Offline pill returns; the tour still shows your latest offline edit (cache write-through survived reload); pending pill still "1". |
| 5 | Go **online**. | Drain runs, then refetch. Pending pill drops to 0. Tour name on the server = your latest edit. No flicker back to the old name (reconnect ordering: replay before refetch). |

---

## 2. Per-entity offline writes

For each, the pattern is: offline → mutate → optimistic UI + saved toast + pending count↑
→ reconnect → pending count↓ → server reflects the change.

### 2.1 Tours
- [x] **Create** a tour offline → reconnect → it exists on the server with the SAME id
  (client-minted; no duplicate created).
- [x] **Create then edit** the same new tour offline (rename, change date) → reconnect →
  ONE tour with the final state (coalesced create, not create+update).
- [x] **Create then delete** the same new tour offline → reconnect → nothing hits the
  server (annihilated), pending count returns to 0.
- [x] **Mark completed** / **toggle visibility** offline → reconnect → persisted.
- [x] **Pick a GPX file offline** on a tour → the track renders offline (from blob cache) →
  reconnect → the GPX is uploaded to Storage, then the row write lands.
- [x] **Delete** an existing tour offline → reconnect → gone on the server.

### 2.2 Contacts (aggregate — the key one)
- [x] Offline: on one contact, **rename it AND add a phone AND mark a different method
  primary AND remove a method** — several actions. Reconnect →
  ONE `update_contact_full` replay reconciles the whole method set; the primary you chose
  is the primary on the server; removed method is gone; no duplicate methods.
- [x] **Create a contact with methods offline** → reconnect → one `create_contact_full`,
  contact + methods present with client-minted ids.
- [x] **Delete a contact offline** → reconnect → gone.

### 2.3 Profile
- [x] Edit profile fields (name etc.) offline → reconnect → persisted.
- [x] Change locale offline → reconnect → persisted.
- [x] **deletePhone offline** → blocked ("This action isn't available offline" snackbar) —
  it's an auth/SMS op, online-only by design.

### 2.4 Availability
- [x] Toggle several days on/off offline, save → optimistic paint + leaves edit mode +
  saved toast. Reconnect → server day-set matches exactly (added + removed reconciled).

---

## 3. Conflict (last-write-wins)

Needs two views of the same row. Use account A in the app + a second device / the
Supabase SQL editor as the "other writer".

- [x] Offline (A), edit tour X's name to "Offline". While A is offline, change tour X on
  the server (SQL: `update tours set name='Server', updated_at=now() where id=...`).
- [x] Reconnect A. Expected: the server's "Server" wins (its `updated_at` is newer than A's
  baseline). A's offline edit does **not** clobber it. The losing write shows in the
  **dead-letter banner** with the **conflict** copy ("Changed on another device — your
  offline edit was not applied").

---

## 4. Dead-letter surface (retry / discard)

Force a permanent failure. Easiest: offline-edit a row, then delete that row on the
server (SQL) before reconnecting — the update-only replay hits 0 rows → dead-letter.

- [x] Reconnect → **amber dead-letter banner** "N changes couldn't sync" → tap **Review**.
- [x] The sheet lists the failed write (kind + op). Tap **Retry** → it re-attempts (will
  re-fail here; that's fine — confirms the retry path runs).
- [x] Tap **Discard** → entry disappears from the list; banner count drops.
  - KNOWN LIMITATION (deferred): discard does not instantly revert the optimistic value in
    the current view — it self-heals on the next refetch (reconnect/foreground). Note
    whether this actually bites you in practice; we'll wire instant-revert if it does.

---

## 5. Deferred notifications (fire once, on replay)

Requires notifications enabled (`VITE_NOTIFICATIONS_ENABLED=true` + VAPID/hook config) OR
just watch the Network tab for the `/notify/*` POSTs.

- [x] Offline create-then-edit a tour → on reconnect the notification says "created"
  (op-keyed), not "updated"; and only one fires.

---

## 6. Attachments online-only (DC10)

- [x] Open a tour's attachments picker **offline** → the add/upload control is replaced by
  the "Attachments are available online only" hint; existing attachments still render and
  open. Go online → the add control returns.

---

## 7. Durability & indicator

- [x] With pending writes queued, fully close and reopen the app (still offline) → the
  **pending pill** is present on launch (durable, read from IndexedDB — not a lost toast).
- [x] Drain everything (reconnect) → pending pill gone on next launch.

---

## Sign-off

- [x] All §1–§7 rows behave as described.
- [x] `npm run test`, `npx eslint .`, `npm run type-check` all clean.
- [x] Migrations verified via `supabase db reset`; ready to prompt for `supabase db push`.
