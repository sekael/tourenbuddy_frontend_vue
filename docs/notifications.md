# Notifications

Single source of truth for every push/email notification the app emits.

## Architecture

Dispatch is **client → Worker fire-and-forget**. After a successful write, a Pinia store
action calls a thin dispatcher in `src/features/notifications/data/notify-dispatch.ts`,
which POSTs to the `email-hook` Worker (`services/email-hook/src/notify.ts`). The Worker
**re-resolves recipients server-side** (never trusts the client for the recipient set),
then fans out push + email.

- **Recipient resolution is the Worker's job.** The client sends ids/actions only.
- **Failures never block the write.** Dispatch is best-effort; errors are logged.
- **Per-recipient gates:** every dispatch honors `notif_push_enabled`, `notif_email_enabled`,
  and `notif_muted_types` on the recipient's `user_profile`.
- **Actor is always suppressed** from the recipient set.
- Notifications require `VITE_NOTIFICATIONS_ENABLED` + `VITE_NOTIFY_HOOK_URL` client-side;
  absent → the dispatcher short-circuits.

## Mute types (`notif_muted_types`)

| Mute key          | Covers                                                         |
| ----------------- | -------------------------------------------------------------- |
| `friend_requests` | Friend request received / responded                            |
| `tour_updates`    | Shared-tour created / updated / deleted                        |
| `tour_interest`   | Collision scan + tour-link lifecycle + group-membership events |

## Notification catalogue

### Friend requests — type `friend_requests`

| Trigger                    | Dispatcher                     | Endpoint                           | Recipient           | Push title (EN / DE)                                     | Push body (EN / DE)                                                             |
| -------------------------- | ------------------------------ | ---------------------------------- | ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A sends B a friend request | `notifyFriendRequestReceived`  | `/notify/friend-request-received`  | request `to_user`   | New friend request / Neue Freundschaftsanfrage           | {actor} wants to connect. / {actor} möchte sich mit dir verbinden.              |
| B responds to A's request  | `notifyFriendRequestResponded` | `/notify/friend-request-responded` | request `from_user` | Friend request update / Antwort auf Freundschaftsanfrage | {actor} responded to your request. / {actor} hat auf deine Anfrage geantwortet. |

Worker handler: `handle(..., 'received' | 'responded')`. Caller must be the expected side
of the request (`403` otherwise).

### Shared-tour changes — type `tour_updates`

Recipients = **tour partners ∩ owner's friends − actor**. Private tours (`visibility !== 'friends'`)
notify no one. Only **meaningful** edits notify (see filter below).

| Trigger                                          | Dispatcher                                               | Endpoint (`action`)                | Push title (EN / DE)                                                                           | Push body (EN / DE)                                                       |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Owner creates a shared tour with friend partners | `notifyTourChanged(id, 'created')`                       | `/notify/tour-changed` (`created`) | New shared tour / Neue geteilte Tour                                                           | {actor} shared "{tour}" with you. / {actor} hat «{tour}» mit dir geteilt. |
| Owner **adds a new partner** during an edit      | `notifyTourChanged(id, 'updated', newPartnerContactIds)` | `/notify/tour-changed` (`updated`) | _newly-added partner gets the `created` copy above_; pre-existing partners get `updated` below | —                                                                         |
| Owner meaningfully edits a shared tour           | `notifyTourChanged(id, 'updated')`                       | `/notify/tour-changed` (`updated`) | Shared tour updated / Geteilte Tour aktualisiert                                               | {actor} updated "{tour}". / {actor} hat «{tour}» aktualisiert.            |
| Owner marks a shared tour completed              | `notifyTourChanged(id, 'updated')`                       | `/notify/tour-changed` (`updated`) | Shared tour updated / Geteilte Tour aktualisiert                                               | {actor} updated "{tour}". / {actor} hat «{tour}» aktualisiert.            |
| Owner deletes a shared tour                      | `notifyTourDeleted(partnerContactIds, name)`             | `/notify/tour-changed` (`deleted`) | Shared tour removed / Geteilte Tour entfernt                                                   | {actor} removed "{tour}". / {actor} hat «{tour}» entfernt.                |

**Meaningful-edit filter** (`tour-notifications.ts → isMeaningfulTourChange`): an edit notifies only
when a partner-facing field changes — name, planned date, goal location, tour type, partner set,
GPX track, description, equipment. Cosmetic/private fields (notes, elevation, seasons,
start/end-point detail) and visibility flips do **not** notify.

**`deleted` resolution:** the row is already gone, so the Worker re-resolves recipients from the
client-cached partner contact ids via `users_by_contact_ids` (the contact-rooted twin of
`tour_partner_user_ids`).

### Tour interest — type `tour_interest`

All dispatched under `tour_interest`; the Worker varies copy by `action`.

| Trigger                                                                                              | Dispatcher                                            | Endpoint (`action`)                                         | Push title EN          | Push body EN                                     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| After a tour save, a friend has a colliding tour (same goal ≤100 m, same type, both friends-visible) | `notifyTourInterest(tourId)`                          | `/notify/tour-interest` (`collision`)                       | Same tour planned      | {actor} planned the same tour as "{tour}".       |
| A link request is created                                                                            | `notifyTourLinkRequestEvent(id, 'created')`           | `/notify/link-request-event` (`link_created`)               | Link request received  | {actor} wants to link "{tour}" with their tour.  |
| A link request is accepted                                                                           | `notifyTourLinkRequestEvent(id, 'accepted')`          | `/notify/link-request-event` (`link_accepted`)              | Tour linked            | {actor} accepted your link request for "{tour}". |
| A link request is declined                                                                           | `notifyTourLinkRequestEvent(id, 'declined')`          | `/notify/link-request-event` (`link_declined`)              | Link request declined  | {actor} declined your link request for "{tour}". |
| A tour joins a link group                                                                            | `notifyGroupMembershipEvent(gid, 'joined')`           | `/notify/group-membership-event` (`group_joined`)           | New tour in your link  | {actor} added a tour to your link for "{tour}".  |
| A tour is evicted from a link group                                                                  | `notifyGroupMembershipEvent(gid, 'evicted_external')` | `/notify/group-membership-event` (`group_evicted_external`) | Tour removed from link | A tour was removed from the link for "{tour}".   |
| A link group dissolves                                                                               | `notifyGroupMembershipEvent(gid, 'dissolved')`        | `/notify/group-membership-event` (`group_dissolved`)        | Tour link dissolved    | The link for "{tour}" was dissolved.             |

Notes: link-request **withdrawals** are intentionally silent. Group-membership recipients follow
the design's membership matrix (joined → pre-existing members; evicted_external → evicted +
remaining; dissolved → lone remaining member); the actor is suppressed by JWT match. Group
dissolution emails use a dedicated template.

## Known gaps

- **Removed partner is not notified.** When an owner removes a partner from a tour, that ex-partner
  receives no "you were removed" notification. The Worker resolves `updated` recipients from the
  live tour row, so a removed partner is already absent from the recipient set. Intentional for now
  (Issue #210) — fix-forward if a "removed from tour" notification is desired.

## Maintenance

This file is hand-maintained. When adding or changing a notification, update the relevant table
and cite the new client dispatcher (`notify-dispatch.ts`) and Worker handler (`notify.ts`).
