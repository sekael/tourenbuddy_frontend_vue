import type { Contact } from '@/features/contacts/domain/entities/contact'

/** Abstract repository interface for contact operations. */
export interface ContactsRepository {
  fetchContacts: () => Promise<Contact[]>
  createContact: (contact: Omit<Contact, 'id' | 'contactMethods'>) => Promise<Contact>
  updateContact: (
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ) => Promise<Contact>
  deleteContact: (id: string) => Promise<void>
}
