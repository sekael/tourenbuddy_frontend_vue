## Why

Issue #262 (user feedback) reports that importing a contact from a file is unfriendly and
undocumented: nothing in the UI says what file type is accepted, where such a file comes
from, or why the option set differs between phones.

The add-contact view (`contacts-list-sheet.vue:642-666`) renders two bare buttons and a
hidden `<input type="file" accept=".vcf,.vcard">`. There is no supporting copy at all.
Two concrete consequences:

- **"Import from contacts" only exists on Android.** It is gated on
  `isContactPickerSupported` (`use-contact-picker.ts:18`), i.e. the Contact Picker API,
  which today is Android Chrome/Edge only. An iOS user sees only "Import from file" and is
  given no hint that the way to produce that file is Contacts → Share Contact → export a
  `.vcf`. The platform difference is real and unavoidable — the UI just never explains it.
- **Every file failure looks identical.** `parseVCardFile` (`use-vcard-import.ts:205`)
  reads the file and parses it; anything that is not a vCard yields `[]`, so the user is
  dropped on an empty results screen with no summary lines and no error. The only error
  string that can appear, `contacts.addDialog.fileImportError` ("File import failed"),
  fires solely when `file.text()` itself rejects. Picking a `.csv`, a photo, or an empty
  file is indistinguishable from success-with-nothing.

## What Changes

- **Import help disclosure** — a new `contact-import-help.vue`, rendered under the import
  buttons in the add-contact view. Always-visible one-liner naming the accepted format
  (`.vcf` / `.vcard`, vCard 2.1–4.0, one file at a time), plus a collapsed
  "How do I export my contacts?" disclosure holding the step-by-step instructions.
- **Platform tab switcher inside the disclosure** — iOS / Android / Desktop tabs
  (`role="tablist"`, same pattern as `tour-list-sheet.vue:134`). Selecting a tab swaps the
  whole step list to that platform. iOS is active on first render for everyone: no
  user-agent sniffing, no capability probe — with all three tabs one tap away, a guess is
  worth less than the regex it would cost (design D2).
- **The Android tab names both paths unconditionally** — "Import from contacts" as the
  one-tap route, `.vcf` export as the fallback — so an Android Firefox user still learns
  the picker exists and an Android Chrome user is not sent through a file round-trip.
- **Distinct import failures** — `parseVCardFile` gains ordered input validation and throws
  a typed `VCardImportError` carrying a `reason` of `'emptyFile' | 'notVCard' |
  'noContacts'`. The add view maps the reason onto its own i18n message, each stating the
  corrective action rather than just the failure.
- **`noContacts` also fixes a live defect.** `parseVCardText` returns one contact per
  `BEGIN:VCARD` block with a `firstName || 'Unknown'` fallback (`use-vcard-import.ts:122`),
  so a card carrying no `N`, `FN` or `TEL` is persisted today as a contact literally named
  "Unknown". When *every* parsed card is that junk, the import now errors instead.
- **The import results screen gets localized** — `contacts-list-sheet.vue:586`, `:590` and
  `:596` embed literal English (`+N more`, `Couldn't parse: …`) into a screen a de-CH user
  reaches on every import. Declared scope addition (design D8).
- **New i18n keys in `en.json` and `de-CH.json`** for the help copy, the tab labels, the
  per-platform steps (flat numbered keys — this repo has no message arrays), the three
  failure messages, and the results-screen strings.
- **Tests** for the failure taxonomy and for the "failure keeps you on the form" regression,
  per the project rule that tests cover edge cases and failures, not the happy path.

Explicitly out of scope: accepting formats other than vCard (CSV, `.csv` exports from
Google Contacts are converted by the user, not by us); multi-file import; a file size cap;
any change to parsing, dedupe, or the import result screen.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `contact-device-import`: the import entry point gains a stated guidance contract (what
  format is accepted, how to obtain it per platform, both Android paths), a stated failure
  taxonomy (empty file, non-vCard, vCard with no importable contacts each surface
  distinctly instead of collapsing into an empty results screen), and a full-localization
  requirement on the results view.

## Impact

- **Code**: one new component (`contact-import-help.vue`), edits to
  `contacts-list-sheet.vue` (mount the component, widen `accept`, map failure reasons,
  localize three result strings), `use-vcard-import.ts` (validate + throw),
  `core/exceptions/index.ts` (one error class).
- **i18n**: new keys in both locale files.
- **Behaviour change**: a `.vcf` whose every card lacks `N`, `FN` and `TEL` now errors
  instead of creating a contact named "Unknown".
- **Tests**: new cases in `test/features/contacts/presentation/composables/use-vcard-import.test.ts`
  and in `test/features/contacts/presentation/components/contacts-list-sheet.test.ts`. No
  test for the help component — after the no-detection decision it holds one ref and a
  `v-if`.
- **Data / DB / Worker**: none. No migration, no `wrangler deploy`.
- **Risk**: low and contained to the add-contact view; the parse path itself is untouched
  beyond the new pre-checks.
