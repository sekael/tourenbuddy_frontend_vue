import type { PhoneEntry } from '@/features/contacts/presentation/stores/contacts-store'
import { storeToRefs } from 'pinia'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

export interface ParsedImportItem {
  firstName: string
  lastName: string | null
  phones: PhoneEntry[]
  rawPhoneNumbers?: string[]
}

export interface ImportResult {
  firstName: string
  lastName: string | null
  primaryPhone: string | null
  extraPhoneCount: number
  rawPhoneNumbers: string[]
  status: 'imported' | 'skipped'
}

/**
 * Single source of truth for importing parsed contacts (vCard, Contact Picker, future sources).
 *
 * Owns the per-contact validity rules:
 *  - duplicate name (against current store) → skip
 *  - had TEL entries but zero parseable → skip (consumer renders the ⚠ rawPhoneNumbers
 *    badge to communicate why)
 *  - had valid + invalid phones → import valid; rawPhoneNumbers carries the discarded values
 *  - no phones at all → import name-only (existing behavior)
 *
 * Phone E.164 validation lives in `core/utils/phone-normalize`; phone dedupe lives in
 * `core/utils/dedupe`. Both are invoked upstream by parsers and the store — this composable
 * does not re-validate, it only decides per-contact disposition.
 */
export function useContactImport() {
  const contactsStore = useContactsStore()
  const { contacts } = storeToRefs(contactsStore)

  function isDuplicate(firstName: string, lastName: string | null): boolean {
    return contacts.value.some(
      c =>
        c.firstName.toLowerCase() === firstName.toLowerCase()
        && (c.lastName ?? '').toLowerCase() === (lastName ?? '').toLowerCase(),
    )
  }

  async function importContacts(items: ParsedImportItem[]): Promise<ImportResult[]> {
    const results: ImportResult[] = []
    for (const item of items) {
      const phones = item.phones
      const rawPhoneNumbers = item.rawPhoneNumbers ?? []
      const primaryPhone = phones.find(p => p.isPrimary)?.value ?? phones[0]?.value ?? null
      const extraPhoneCount = Math.max(0, phones.length - 1)
      const base = {
        firstName: item.firstName,
        lastName: item.lastName,
        primaryPhone,
        extraPhoneCount,
        rawPhoneNumbers,
      }

      if (isDuplicate(item.firstName, item.lastName)) {
        results.push({ ...base, status: 'skipped' })
        continue
      }

      // Had TEL entries but none parseable → skip; consumer shows the ⚠ rawPhoneNumbers row
      if (phones.length === 0 && rawPhoneNumbers.length > 0) {
        results.push({ ...base, primaryPhone: null, extraPhoneCount: 0, status: 'skipped' })
        continue
      }

      await contactsStore.addContact(item.firstName, item.lastName, null, phones, 'import')
      results.push({ ...base, status: 'imported' })
    }
    return results
  }

  return { importContacts }
}
