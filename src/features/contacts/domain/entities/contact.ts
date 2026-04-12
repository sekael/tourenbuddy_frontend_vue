import type { z } from 'zod'
import type { contactSchema } from '@/features/contacts/data/models/contact-schema'

/** Domain entity for a contact (tour partner). */
export type Contact = z.infer<typeof contactSchema>

/** Returns the best display name for a contact. */
export function resolveContactName(contact: Contact): string {
  if (contact.displayName) return contact.displayName
  if (contact.lastName) return `${contact.firstName} ${contact.lastName}`
  return contact.firstName
}
