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
  skipReason?: 'nameDuplicate' | 'unparseable' | 'phoneDuplicate'
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
      const rawPhoneNumbers = item.rawPhoneNumbers ?? []
      const base = { firstName: item.firstName, lastName: item.lastName, rawPhoneNumbers }

      if (isDuplicate(item.firstName, item.lastName)) {
        const primaryPhone = item.phones.find(p => p.isPrimary)?.value ?? item.phones[0]?.value ?? null
        results.push({
          ...base,
          primaryPhone,
          extraPhoneCount: Math.max(0, item.phones.length - 1),
          status: 'skipped',
          skipReason: 'nameDuplicate',
        })
        continue
      }

      // Had TEL entries but none parseable → skip; consumer shows the ⚠ rawPhoneNumbers row
      if (item.phones.length === 0 && rawPhoneNumbers.length > 0) {
        results.push({
          ...base,
          primaryPhone: null,
          extraPhoneCount: 0,
          status: 'skipped',
          skipReason: 'unparseable',
        })
        continue
      }

      // Cross-contact duplicates: skip phones already held by another existing contact
      const nonDuplicatePhones = item.phones.filter(
        p => !contactsStore.findContactByMethodValue('phone', p.value),
      )
      if (item.phones.length > 0 && nonDuplicatePhones.length === 0) {
        results.push({
          ...base,
          primaryPhone: null,
          extraPhoneCount: 0,
          status: 'skipped',
          skipReason: 'phoneDuplicate',
        })
        continue
      }

      await contactsStore.addContact(item.firstName, item.lastName, null, nonDuplicatePhones, 'import')
      results.push({
        ...base,
        primaryPhone: nonDuplicatePhones.find(p => p.isPrimary)?.value ?? nonDuplicatePhones[0]?.value ?? null,
        extraPhoneCount: Math.max(0, nonDuplicatePhones.length - 1),
        status: 'imported',
      })
    }
    return results
  }

  return { importContacts }
}
