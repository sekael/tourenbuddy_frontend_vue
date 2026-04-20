## Context

Contact chip today (`src/features/contacts/presentation/components/contact-chip.vue`) emits a `toggle` event on click and conditionally renders inline `tel:` + `wa.me` anchor icons when `showActions` is true. `tour-info-sheet.vue` passes `showActions` for each partner; `tour-form.vue` uses the chip in selection mode (without actions). Contacts have 0..N phone methods with one flagged primary (`getPrimaryPhone`, `orderedPhoneMethods`). Phone methods expose `telLink`/`whatsAppLink` via `usePhoneActions`. SMS is not yet surfaced anywhere.

The contacts edit flow already lives in `contacts-list-sheet` + `contact-detail-view` + `contact-form`, reachable via `/contacts` route. Issue #50 wants the chip itself to be the trigger for per-contact methods, add an edit-contact entry, and add a tour-level group-SMS action.

## Goals / Non-Goals

**Goals:**

- Preserve chip toggle-select behavior in tour-form.
- Surface all phone-method actions (call, SMS, WhatsApp) from the chip, not just the primary phone's two icons.
- Native-feeling interaction on both form factors.
- Deep-link into existing contact edit flow from a tour.
- Group SMS launch across all partners with valid SMS-capable phones, with a preflight dialog.

**Non-Goals:**

- WhatsApp group chat (deferred until WhatsApp supports a deterministic group-creation deep link).
- Email / messaging apps beyond SMS + WhatsApp.
- Per-contact opt-out within the group-SMS dialog.
- New in-tour-sheet inline contact edit form.

## Decisions

### D1. Chip has a mode/variant prop instead of overloaded `showActions`

`showActions` becomes obsolete: view contexts always open the menu, selection contexts always toggle. Add `mode: 'select' | 'action'` (default `'select'`), emit `toggle` in select mode and `open` in action mode. `showActions` is removed. This keeps `tour-form` selection behavior untouched (just no new prop) and makes intent explicit.

_Alternatives:_ keep `showActions` and add `clickable` — rejected; two overlapping booleans.

### D2. Responsive action menu via a new `ContactActionMenu` component

Reuse the existing `responsive-overlay` (spec: `responsive-overlay`) / `bottom-sheet` + anchored popover pattern already in the codebase. On desktop (`useIsDesktop`), render as a popover anchored to the chip's bounding rect. On mobile, render as a bottom action sheet (`bottom-sheet.vue`) with large tap targets — gives the native feel the user asked for. Component lives at `contacts/presentation/components/contact-action-menu.vue`.

_Alternatives:_ single popover for both form factors — rejected, small popovers feel cramped on mobile. A full-screen sheet — rejected, too heavy for 2-3 actions.

### D3. Action list derived from `orderedPhoneMethods(contact)`, filtered to valid methods

For each phone method where `isValid === true` and the value is E.164 (non-null `whatsAppLink`), produce Call + WhatsApp actions only. Call uses `tel:`, WhatsApp uses `whatsAppLink`. SMS is not offered as a 1:1 action (WhatsApp is the default messaging channel). Invalid / legacy-formatted methods are dropped entirely from the menu — rationale: if we can't produce a trustworthy `wa.me` link, we don't trust the raw string for `tel:` either; better to push the user to fix the phone via Edit contact than to fire a misdialed call.

Contacts with multiple valid methods render one row per method (label + Call + WhatsApp) so the user explicitly picks which number to use — no silent primary fallback. Edit-contact is a separate action row at the bottom.

A helper `buildContactActions(contact): ContactAction[]` centralises the mapping. A parallel `buildGroupSmsRecipients(partners): { included, excluded }` helper powers the group-SMS filter and is independent of `buildContactActions` (different eligibility: group uses `sms:<E.164>` per partner's primary, not per all methods).

### D4. Edit-contact navigates to existing contacts flow

Tapping "Edit contact" calls `router.push({ name: 'contacts', query: { edit: contact.id } })` (or equivalent existing deep-link; if missing, add a query param handler in `contacts-list-sheet` that auto-opens `contact-detail-view` for the given id). No new form instance — reuse current flow per requirements. Tour info sheet auto-closes before navigation on mobile to avoid stacked sheets; desktop can keep the tour side-drawer open.

### D5. Group SMS row separate from chip row; SMS is the only group channel

When `partners.length > 1`, render a second row under the chips in tour-info-sheet: a single "Message all" SMS icon button. SMS is used _only_ here — as a fallback, not as a 1:1 action — because WhatsApp has no deterministic multi-recipient / group-creation deep link. Tap opens `GroupSmsConfirmDialog` listing:

- Included: partners whose primary phone is a valid E.164 number (suitable as an `sms:` recipient).
- Excluded: partners without a valid E.164 primary, with one-line reason ("no valid phone number").

Confirm launches `sms:<n1>,<n2>,…` (comma-separated E.164). No body prefill. iOS and Android both support comma-separated recipients in `sms:` URIs.

_Alternatives:_ open OS share sheet — rejected, inconsistent across platforms and not a message-first UX. Add WhatsApp alongside — rejected, no deterministic group link. Sequential per-contact WhatsApp opens — rejected, disorienting UX.

### D6. No confirmation for 1:1 actions

Per user directive: Call and WhatsApp in the single-contact menu fire immediately. Confirmation dialog exists only for the group SMS action because its effect (a draft addressed to N people) is asymmetric and worth previewing.

### D7. Call action is single-contact only

Group row never includes a call icon. Menu-level call action is always per-phone-method.

## Risks / Trade-offs

- [`sms:` with multiple recipients not supported on some less-common browsers/OS versions] → Keep URI simple (`sms:+41..,+41..`), test on iOS Safari + Chrome Android; document fallback to copy-numbers if reports come in later.
- [WhatsApp users may expect a group option and see only SMS] → Dialog text clarifies "Send SMS to all partners"; WhatsApp group chat called out in follow-up.
- [Deep-linking edit from tour may interrupt tour context] → Desktop keeps tour side-drawer; mobile accepts the navigation since bottom sheets can't stack meaningfully.
- [Chip click target shrinks once inline icons are removed — but label-only chip is actually larger overall; verify min 44px tap area on mobile].

## Migration Plan

UI-only change. No data migration. Rollout is a single PR. Old `showActions` prop removed — update all call sites in one commit. Feature visible on merge; no flag required.

## Open Questions

- Does a contacts deep-link query param (`?edit=<id>`) already exist? If not, introduce it as part of this change (minor addition to `contacts-list-sheet`). Flagged as a task to verify.
