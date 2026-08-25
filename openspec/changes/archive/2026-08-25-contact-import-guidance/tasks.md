## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/262-contact-import-guidance`

## 2. i18n copy (both locales, same commit)

- [x] 2.1 `src/locales/en.json` — add under `contacts.addDialog`: `help.formatHint` (names `.vcf` / `.vcard`, one file which may hold many contacts), `help.summary` ("How do I export my contacts?"), `help.tabIos` / `help.tabAndroid` / `help.tabDesktop`
- [x] 2.2 `src/locales/en.json` — add the steps as **flat numbered keys** (`help.iosStep1`, `help.iosStep2`, …), never arrays: no locale file in this repo holds an array and nothing calls `tm()`/`rt()` (design D10). Content: iOS (Contacts → select contact → Share Contact → Save to Files → return and pick the `.vcf`); Android (use "Import from contacts" if the button is shown; otherwise Contacts → Share/Export → `.vcf`) — unconditional, both paths always listed (design D3); Desktop (macOS Contacts → File → Export → Export vCard; Google Contacts → select → Export → vCard; Outlook → export as vCard)
- [x] 2.3 `src/locales/en.json` — add `contacts.addDialog.fileError.emptyFile`, `.notVCard`, `.noContacts`. Each message MUST state the corrective action, not only the failure — this prose replaces an auto-expanding disclosure (design D5)
- [x] 2.4 `src/locales/en.json` — add keys for the results-screen strings hardcoded today (design D8): a parameterized extra-phone-count key (replaces `+N more`) and a parameterized unparseable-list key (replaces `Couldn't parse: …`)
- [x] 2.5 `src/locales/de-CH.json` — mirror every key added in 2.1–2.4. Never leave a locale short; check for an existing reusable key before adding a new one

## 3. Error type

- [x] 3.1 `src/core/exceptions/index.ts` — add `export type VCardImportFailure = 'emptyFile' | 'notVCard' | 'noContacts'` and `export class VCardImportError extends Error` carrying `readonly reason: VCardImportFailure` and `name = 'VCardImportError'`, following the shape of the existing classes in that file

## 4. Parser validation — **your gap**

- [x] 4.1 `src/features/contacts/presentation/composables/use-vcard-import.ts:205` — implement the ordered validation inside `parseVCardFile` per design D4, marked with `// TODO(me):`. Order matters: `emptyFile` (zero bytes or whitespace-only text) → `notVCard` (no case-insensitive `BEGIN:VCARD` in the **content**, never the filename) → `noContacts` (parsed, but every contact is junk: `'Unknown'` name fallback with no `phones` and no `rawPhoneNumbers`). Throw `VCardImportError` with the matching reason. `parseVCardFiles` inherits by delegation — do not duplicate the checks. `parseVCardText` stays pure and must keep returning `[]` for junk (`test/…/use-vcard-import.test.ts:87` depends on it)

## 5. Help component

- [x] 5.1 New `src/features/contacts/presentation/components/contact-import-help.vue` — `<details>` / `<summary>` disclosure (design D1), collapsed by default, summary bound to `contacts.addDialog.help.summary`. No `:open` binding, no auto-expand on error
- [x] 5.2 Tab switcher: three buttons with `role="tab"`, `:aria-selected`, `tab--active` class inside `role="tablist"` — mirror the markup and styling at `tour-list-sheet.vue:134-160`. Steps container gets `role="tabpanel"`. A single `ref` holds the active tab, initialized to `'ios'` unconditionally: no UA sniffing, no `maxTouchPoints`, no capability probe (design D2)
- [x] 5.3 Render each platform's steps from the flat numbered keys via an explicit list in the template. Android panel is unconditional — do NOT import `isContactPickerSupported` (design D3)
- [x] 5.4 Scoped styles using existing tokens only (`--spacing-*`, `--color-outline-variant`, `--font-size-sm`). No new tokens

## 6. Wire into the add view

- [x] 6.1 `src/features/contacts/presentation/components/contacts-list-sheet.vue:666` — render `contacts.addDialog.help.formatHint` as always-visible copy under `.import-actions`, then `<ContactImportHelp />`, both above the existing `.divider`. Add-view only — nothing goes on the contacts empty state (design D9)
- [x] 6.2 `contacts-list-sheet.vue:659` — widen to `accept=".vcf,.vcard,text/vcard,text/x-vcard"` (design D6). Keep single-file: do NOT add `multiple`
- [x] 6.3 `contacts-list-sheet.vue:374` `handleFileChange` — map a caught `VCardImportError` to `t('contacts.addDialog.fileError.' + err.reason)`; keep today's generic fallback for every other throwable (design D5). Verify `addViewState` stays `'form'` on failure — `processImportedContacts` must not run

## 7. Results-screen localization (design D8)

- [x] 7.1 `contacts-list-sheet.vue:586` — replace `+{{ result.extraPhoneCount }} more` with the parameterized key from 2.4
- [x] 7.2 `contacts-list-sheet.vue:590` — replace the `` `Couldn't parse: ${…}` `` tooltip binding with the parameterized key from 2.4
- [x] 7.3 `contacts-list-sheet.vue:596` — replace the inline `` ` +${…} more` `` fragment with the same extra-count key used in 7.1
- [x] 7.4 `contacts-list-sheet.vue` — split the discarded-number notice by `result.status`: skipped keeps `contacts.list.invalidPhoneWarning` in the error colour, imported uses the new `contacts.addDialog.discardedPhones` in the warning colour. Extracted as `rawPhoneSummary()` so the template loses the nested ternary
- [x] 7.5 `contacts-list-sheet.vue` — suppress the phone notice entirely on rows skipped as `nameDuplicate` / `phoneDuplicate` (`showsRawPhones()`): a duplicate skip outranks any phone complaint, since nothing was attempted
- [x] 7.6 Tests for all three row states in `contacts-list-sheet.test.ts`: skipped-unparseable (error tone), imported-with-discards (warning tone), skipped-duplicate (no notice)

## 8. Tests (edge cases and failures only)

- [x] 8.1 `test/features/contacts/presentation/composables/use-vcard-import.test.ts` — a zero-byte file and a whitespace-only file each reject with `reason: 'emptyFile'`
- [x] 8.2 Same file — CSV-ish text rejects with `reason: 'notVCard'`; a `BEGIN:VCARD` payload in a file named `contact.txt` parses successfully (content beats filename, design D4)
- [x] 8.3 Same file — a card with no `N`, `FN` or `TEL` rejects with `reason: 'noContacts'`; a file mixing that card with one usable contact does NOT throw and returns the usable contact
- [x] 8.4 `test/features/contacts/presentation/components/contacts-list-sheet.test.ts` — make the existing `useVCardImport` mock (line 11) reject with a real `VCardImportError`; assert the reason-specific message renders AND `addViewState` stays on the form (no results screen). This is the regression guard for the actual bug
- [x] 8.5 No test for `contact-import-help.vue`: after D2 and D3 it is one ref and a `v-if`, and asserting that a click sets a ref is the happy path the testing convention excludes
- [x] 8.6 `npm run test` — all pass

## 9. Manual verification

- [x] 9.1 `npm run dev` → add contact → expand the disclosure: iOS tab active, switching tabs swaps every step, all three reachable by keyboard
- [x] 9.2 Import a `.csv`, an empty `.vcf`, an `ORG:`-only `.vcf`, and a real export: four distinct outcomes, no blank results screen, no contact named "Unknown"
- [x] 9.3 Switch locale to de-CH and complete one import: the results screen contains no English fragments

## 10. Finalize

- [x] 10.1 `npx eslint . --fix` — zero warnings
- [x] 10.2 `npm run type-check` — clean
- [x] 10.3 Prompt user to commit (do NOT commit) with message:
      `feat(contacts): explain vCard import per platform and report file failures distinctly (#262)`
      and a body declaring the two scope additions: results-screen localization (D8) and the
      `noContacts` behaviour change that stops creating "Unknown" rows (D4)
- [x] 10.4 Prompt user to push the branch and open a PR to `main`
- [x] 10.5 Prompt user to archive this change with the `openspec-archive` skill
