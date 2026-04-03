import type { Contact } from '@/features/contacts/domain/entities/contact'

/** Abstract repository interface for contact operations. */
export interface ContactsRepository {
  fetchContacts: () => Promise<Contact[]>
  createContact: (contact: Omit<Contact, 'id'>) => Promise<Contact>
}
