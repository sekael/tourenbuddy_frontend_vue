import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'

/** Returns phone methods with the primary first, remaining in insertion order. */
export function orderedPhoneMethods(contact: Contact): ContactMethod[] {
  const phones = contact.contactMethods.filter((m) => m.methodType === 'phone')
  const primary = phones.find((m) => m.isPrimary)
  if (!primary) return phones
  return [primary, ...phones.filter((m) => m.id !== primary.id)]
}
