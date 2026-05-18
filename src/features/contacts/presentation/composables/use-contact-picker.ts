import type { ParsedName } from '@/features/contacts/core/utils/parse-contact-name'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { dedupeEmails, dedupePhones, dedupeRawPhones } from '@/features/contacts/core/utils/dedupe'
import { parseContactName } from '@/features/contacts/core/utils/parse-contact-name'

export interface PickedPhone {
  value: string
  label: null
  isPrimary: boolean
}

export interface PickedContact extends ParsedName {
  phones: PickedPhone[]
  rawPhoneNumbers: string[]
  emails: string[]
}

/** Returns whether the Contact Picker API is available (Android Chrome/Edge). */
export const isContactPickerSupported = 'contacts' in navigator && 'ContactsManager' in window

/** Composable for importing contacts via the native Contact Picker API. */
export function useContactPicker() {
  async function pickContacts(): Promise<PickedContact[]> {
    if (!isContactPickerSupported)
      return []

    try {
      // @ts-expect-error Contact Picker API not in TypeScript DOM lib yet
      const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true })
      return (contacts as Array<{ name: string[], tel: string[], email: string[] }>).map((entry) => {
        const fullName = entry.name[0] ?? ''
        const parsed = parseContactName(fullName)
        const phones: PickedPhone[] = []
        const rawPhoneNumbers: string[] = []
        let firstValid = true
        for (const raw of entry.tel ?? []) {
          const trimmed = raw.trim()
          const normalized = normalizePhone(trimmed)
          if (normalized.ok) {
            phones.push({ value: normalized.e164, label: null, isPrimary: firstValid })
            firstValid = false
          }
          else if (trimmed) {
            rawPhoneNumbers.push(trimmed)
          }
        }
        const emails = dedupeEmails(entry.email ?? [])
        return {
          ...parsed,
          phones: dedupePhones(phones),
          rawPhoneNumbers: dedupeRawPhones(rawPhoneNumbers),
          emails,
        }
      })
    }
    catch {
      return []
    }
  }

  return { isSupported: isContactPickerSupported, pickContacts }
}
