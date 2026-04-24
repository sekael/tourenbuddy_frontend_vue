import type { Contact } from '@/features/contacts/domain/entities/contact'
import { formatPhoneDisplay } from '@/features/contacts/domain/entities/contact'
import { orderedPhoneMethods } from './order-phone-methods'

const E164_REGEX = /^\+[1-9]\d{1,14}$/

export interface ContactAction {
  methodId: string
  label: string
  call: string
  whatsApp: string
}

export interface GroupSmsResult {
  included: { contact: Contact; e164: string }[]
  excluded: { contact: Contact; reason: string }[]
}

/** Returns one action entry per valid phone method, ordered primary-first. */
export function buildContactActions(contact: Contact): ContactAction[] {
  return orderedPhoneMethods(contact)
    .filter((m) => m.isValid && E164_REGEX.test(m.value))
    .map((m) => {
      const digits = m.value.slice(1)
      return {
        methodId: m.id,
        label: m.label ?? formatPhoneDisplay(m.value),
        call: `tel:${m.value}`,
        whatsApp: `https://wa.me/${digits}`,
      }
    })
}

/** Returns included/excluded partners for group SMS based on primary phone validity. */
export function buildGroupSmsRecipients(partners: Contact[]): GroupSmsResult {
  const included: GroupSmsResult['included'] = []
  const excluded: GroupSmsResult['excluded'] = []

  for (const contact of partners) {
    const phones = contact.contactMethods.filter((m) => m.methodType === 'phone')
    const primary = phones.find((m) => m.isPrimary) ?? phones[0]
    if (primary && primary.isValid && E164_REGEX.test(primary.value)) {
      included.push({ contact, e164: primary.value })
    } else {
      excluded.push({ contact, reason: 'No valid phone number' })
    }
  }

  return { included, excluded }
}
