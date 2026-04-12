import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactsRepository } from '@/features/contacts/domain/repositories/contacts-repository'
import { supabase } from '@/core/utils/supabase'
import { contactRowSchema } from '@/features/contacts/data/models/contact-schema'

export class ContactsRepositoryImpl implements ContactsRepository {
  async fetchContacts(): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, contact_methods(*)')
      .order('first_name', { ascending: true })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => contactRowSchema.parse(row))
  }

  async createContact(contact: Omit<Contact, 'id' | 'contactMethods'>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: contact.userId,
        first_name: contact.firstName,
        last_name: contact.lastName ?? null,
        display_name: contact.displayName ?? null,
      })
      .select('*, contact_methods(*)')
      .single()

    if (error) throw new Error(error.message)

    return contactRowSchema.parse(data)
  }
}
