import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'

/** Abstract repository interface for contact operations. */
export interface ContactsRepository {
  fetchContacts: () => Promise<Contact[]>
  createContact: (
    contact: Omit<Contact, 'id' | 'contactMethods'>,
    methods: NewContactMethod[],
  ) => Promise<Contact>
  updateContact: (
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ) => Promise<Contact>
  deleteContact: (id: string) => Promise<void>
}
