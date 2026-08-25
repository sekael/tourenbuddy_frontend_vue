## Context

The add-contact view lives inside `contacts-list-sheet.vue` (1045 lines) as
`viewState === 'add'` → `addViewState === 'form'`. Its import affordances are:

| element | file:line | condition |
|---|---|---|
| "Import from file" button | `contacts-list-sheet.vue:642` | always |
| hidden `<input type="file" accept=".vcf,.vcard">` | `contacts-list-sheet.vue:659` | always, single file (no `multiple`) |
| "Import from contacts" button | `contacts-list-sheet.vue:650` | `v-if="isContactPickerSupported"` |
| `.divider` then the manual form | `contacts-list-sheet.vue:668` | always |

`isContactPickerSupported` is a module constant, evaluated once at import:
`'contacts' in navigator && 'ContactsManager' in window` (`use-contact-picker.ts:18`).
That is the Contact Picker API — **Android Chrome/Edge over HTTPS only**. Safari (iOS and
macOS), desktop Chrome and Firefox have never shipped it. So the two-button state is
Android-Chrome-only and the one-button state is everyone else. Correct behaviour the UI
never explains.

Note the import buttons are **inside the add view**, not the contacts list: a first-run
user on the empty state (`:497-505`) sees only `emptyTitle` / `emptySubtitle` and must tap
"Add contact" (`:470`) to reach them.

The file path today:

```
handleFileChange (contacts-list-sheet.vue:374)
  → parseVCardFile (use-vcard-import.ts:205)  →  file.text() → parseVCardText
  → processImportedContacts (…:329) → addViewState = 'import-results'
```

`parseVCardText` (`:65`) splits on `BEGIN:VCARD` and maps **every** block to a contact,
falling back to `firstName || 'Unknown'` (`:122`, `:161`). Two consequences that shape the
whole change:

- Given a CSV, a JPEG or an empty file it finds no blocks and returns `[]` — no throw.
  `processImportedContacts` then switches to `import-results` with an empty list and an
  all-zero summary, so **every bad file renders as a blank success screen**. The `catch` at
  `:381` is only reachable if `file.text()` itself rejects, which is why the generic
  "File import failed" has likely never been seen.
- Given a vCard block with no `N`/`FN` and no `TEL`, it returns a contact literally named
  **"Unknown"**, which the store then persists as a real row.

Prior art reused rather than reinvented:

- Tab markup + ARIA + active-class styling: `tour-list-sheet.vue:134-160`.
- Error classes: `core/exceptions/index.ts` (five today, all plain `Error` subclasses).

## Goals / Non-Goals

**Goals**

- State the accepted format at the point of decision, before the file chooser opens.
- Give a user on any of the three platform families a concrete path from "my contacts are
  in my phone" to "the contact is in TourenBuddy".
- Make each way a file import can fail say what went wrong and what to do instead, without
  advancing to a blank results screen.
- Stop persisting name-less junk as a contact called "Unknown".
- Add no dependency and no new overlay; the add view must stay scannable.

**Non-Goals**

- Supporting non-vCard formats. Google Contacts and Outlook both export vCard; steering
  users to that export beats writing a CSV column-mapper.
- Multi-file or multi-select import (`parseVCardFiles` already rejects `files.length !== 1`
  by design — one `.vcf` may contain many contacts, which is the intended bulk path).
- Any change to phone normalization, dedupe, primary selection, or the import results
  layout beyond the i18n fix in D8.
- Surfacing import affordances on the contacts empty state. Considered and rejected: the
  guidance belongs beside the buttons it describes (D9).
- Making the Contact Picker work where the browser does not support it. Nothing can.

## Decisions

### D1 — Native `<details>` for the disclosure, and it stays stateless

The collapsed help is a `<details>` / `<summary>` pair: keyboard-operable, correct
expanded/collapsed state for assistive tech, zero JavaScript, zero component state. A
custom `ref(false)` + `v-if` expander would be more code for strictly less accessibility.

This is also why failure messages do **not** auto-expand it (D5). Binding `:open` to an
error would reintroduce the state this decision exists to avoid, and would yank content
open under a user who deliberately collapsed it.

*Rejected:* a separate help sheet behind an info icon — hides content behind two
interactions on the screen where the user is already lost, and adds an overlay to a
component already juggling three view states.

### D2 — Tabs for platform, with no detection at all

The disclosure body is a `role="tablist"` of three tabs — **iOS**, **Android**,
**Desktop** — each swapping the entire step list, following the markup and ARIA of
`tour-list-sheet.vue:134`. **iOS is active on first render, unconditionally.** There is no
user-agent sniffing, no `maxTouchPoints` probe, and no capability probe.

Detection was designed in and then removed deliberately. With all three tabs one tap away
and visible, the value of guessing correctly is a single tap saved; the cost is a UA regex
that every browser release can invalidate, a Macintosh-vs-iPad special case, and a branch
that has to be stubbed in tests. iOS leads because it is the platform with no picker
fallback — its users are the ones for whom the file path is the *only* path.

*Rejected:* feature-detecting Android via `isContactPickerSupported`. That constant is
Chrome/Edge-only, so **Android Firefox** would resolve to Desktop and be shown macOS
Contacts steps on a phone. It answers "which button do you get", not "how do I export".

### D3 — Three tabs; Desktop covers macOS + Google + Outlook; Android names both paths

Windows has no native contacts app worth exporting from, so a fourth "Windows" tab would
really be a "Google Contacts / Outlook" tab — and those are equally the desktop path for a
macOS user whose contacts live in Google. One Desktop tab holding the macOS Contacts steps
and the Google Contacts steps as short separate blocks keeps every path one tap away
without a tab that lies about its scope.

The Android panel is **unconditional**: it names the "Import from contacts" button as the
one-tap path *and* gives the `.vcf` export steps as the fallback, without branching on
`isContactPickerSupported`. Branching would hide the picker path from an Android Firefox
user who could use it in Chrome, and would show file steps to an Android Chrome user who
has the faster option on screen. Stating both truths on one panel is shorter to write,
impossible to get wrong, and removes an import from the component.

### D4 — The failure taxonomy is decided in the parser, and `noContacts` means *no importable* contacts

`parseVCardFile` is the single seam both file callers route through (`parseVCardFiles`
delegates to it). Putting the checks there means the component maps a reason to a message
and nothing more, and any future caller inherits the validation. `parseVCardText` stays
pure and keeps returning `[]` for junk — `test/…/use-vcard-import.test.ts:87` depends on
that and is not to be changed.

Checks run in this order, because the order changes the answer:

1. **`emptyFile`** — `file.size === 0` or the read text is whitespace-only. First, because
   an empty `.vcf` is an empty file, not "not a vCard", and telling the user their export
   produced nothing is the actionable message.
2. **`notVCard`** — the text contains no case-insensitive `BEGIN:VCARD`. A *content*
   check, deliberately not an extension check: files from a share sheet or a download may
   carry `.txt`, a doubled extension, or none at all, and rejecting those on filename would
   refuse valid data. The `accept` attribute biases the chooser; content is the authority.
3. **`noContacts`** — the text parsed, but every contact it produced is junk.

Point 3 needs its definition stated, because the obvious reading of it is unreachable:
`parseVCardText` yields one contact per `BEGIN:VCARD` block and never zero when the marker
is present, so "parsed to an empty array" is the same condition as `notVCard`. A contact is
therefore **junk** when it carries the `'Unknown'` name fallback **and** has no `phones`
**and** no `rawPhoneNumbers` — i.e. a block with no `N`, no `FN` and no `TEL`, such as an
`ORG:`- or `NOTE:`-only card. If every parsed contact is junk, `parseVCardFile` throws
`noContacts`.

This is a deliberate behaviour change, not only a message: today such a file silently
creates a row named "Unknown". A name that exists only as a fallback rung is not a name;
the honest outcome is an error that tells the user their export carried no usable contact.
A mixed file (one real contact, one junk block) still imports the real one — junk-only is
the trigger.

Carrier: a `VCardImportError extends Error` in `core/exceptions/index.ts` (where this
project's error classes live) with a `reason: VCardImportFailure` field. A typed field
rather than message-matching, so the component's mapping cannot silently break when copy
changes.

### D5 — Only `handleFileChange` maps reasons; failure copy routes the user in prose

`handleFileChange:381` keeps its existing fallback for unknown throwables (an I/O rejection
from `file.text()` is still possible and still generic). The new branch: a
`VCardImportError` resolves `contacts.addDialog.fileError.<reason>`; anything else keeps
today's behaviour. The view stays on the form — `addViewState` must **not** flip to
`import-results`, which is precisely the bug being fixed.

Each failure message must name the fix, not just the failure ("That isn't a vCard file —
export a `.vcf` from your contacts app and try again"). That prose does the routing work
that an auto-expanding disclosure would otherwise do, with the help's own summary — "How do
I export my contacts?" — sitting directly above it. See D1 for why nothing auto-expands.

### D6 — Widen `accept` with vCard MIME types

`accept=".vcf,.vcard"` becomes `accept=".vcf,.vcard,text/vcard,text/x-vcard"`. Some Android
choosers filter by MIME type and grey out a share target advertising only `text/vcard`,
leaving the user unable to pick a file that would parse fine. This widens what the chooser
offers without weakening validation, because D4 validates content, not the picker.

### D7 — No file size cap

Considered and dropped. vCards are text; a 5 000-contact export is on the order of 2 MB and
the parser is a regex sweep over a string. A cap would be a magic number defending against
a case no user has hit, and would reject legitimate large exports.

### D8 — The import results screen's untranslated English is fixed here

Three hardcoded English fragments render on the screen every successful import ends on:

- `contacts-list-sheet.vue:586` — `+{{ result.extraPhoneCount }} more`
- `:590` — `` `Couldn't parse: ${…}` `` (tooltip, fully untranslated)
- `:596` — `` ` +${…} more` ``

A de-CH user currently reads German summary lines with English spliced in, violating the
i18n convention. The edits are mechanical, land in a file this change already opens, and
sit inside the flow the issue is about. Declared explicitly here and in the commit body so
review sees scope stated rather than smuggled.

### D9 — Guidance lives beside the buttons, in the add view only

Not on the contacts empty state. Mounting the disclosure there would explain an action
whose affordance isn't rendered on that screen; lifting an import button up there instead
would drag `handleFileChange`'s view-state assumptions along (`addViewState` is set on
success while `viewState` would still be `'list'`). The empty state's job is to point at
the Add button, which it does.

### D10 — Flat numbered i18n keys for the steps

No locale file in this repo contains an array, and nothing calls `tm()` / `rt()`. The steps
are therefore `help.iosStep1`, `help.iosStep2`, … rendered by an explicit list in the
template — matching the existing convention rather than introducing message-array APIs for
one component.

## Risks / Trade-offs

- **Written instructions rot** when Apple, Google or Microsoft move a menu item. Mitigated
  by short steps that name menus rather than screenshots, and by the fact that a
  slightly-stale step list still beats today's zero guidance.
- **`noContacts` changes import behaviour** (D4): a junk-only `.vcf` that previously
  produced an "Unknown" row now errors. Accepted deliberately — that row was never useful,
  and the user is now told why.
- **iOS-first tab is a guess for non-iOS users** (D2). Costs one tap; all tabs visible.
- **The add view grows.** The disclosure is collapsed by default and lives in its own
  component, so the collapsed cost is one hint line plus a summary row.
  `contacts-list-sheet.vue` is already far past the ~150-line convention; this change adds
  a component rather than more lines to it.
- **Translation debt**: the per-platform steps roughly double the `addDialog` key count in
  both locales. Accepted — that copy *is* the deliverable, and `de-CH` lands in the same
  commit per the i18n convention.

## Migration Plan

None. No schema, no stored state, no feature flag. Additive UI plus stricter error
reporting on a path that currently reports nothing.

## Open Questions

None. Format scope (vCard only), tab set and ordering, no-detection, the unconditional
Android panel, the `noContacts` redefinition, help placement, error-copy routing, the
results-screen i18n fix, the no-size-cap call and the test surface were all settled with
the issue author before implementation.
