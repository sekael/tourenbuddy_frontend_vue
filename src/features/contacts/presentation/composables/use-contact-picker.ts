import type { ParsedName } from '@/features/contacts/core/utils/parse-contact-name'
import { parseContactName } from '@/features/contacts/core/utils/parse-contact-name'

export interface PickedContact extends ParsedName {
  phoneNumber: string | null
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
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      return (contacts as Array<{ name: string[], tel: string[] }>).map((entry) => {
        const fullName = entry.name[0] ?? ''
        const parsed = parseContactName(fullName)
        const phoneNumber = entry.tel[0]?.trim() || null
        return { ...parsed, phoneNumber }
      })
    }
    catch {
      return []
    }
  }

  return { isSupported: isContactPickerSupported, pickContacts }
}
