import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import type { ContactsRepository } from '@/features/contacts/domain/repositories/contacts-repository'
import { DuplicateContactAcrossContactsError, DuplicateContactMethodError } from '@/core/exceptions'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { supabase } from '@/core/utils/supabase'
import { contactRowSchema } from '@/features/contacts/data/models/contact-schema'

function resolveMethodValue(method: NewContactMethod): string {
  if (method.methodType !== 'phone')
    return method.value
  const result = normalizePhone(method.value)
  if (!result.ok)
    throw new Error(`Invalid phone number: "${method.value}"`)
  return result.e164
}

function mapCreateContactError(error: { code: string, message: string }): Error {
  if (error.code === '23505' && error.message.includes('contact_methods_unique_per_contact'))
    return new DuplicateContactMethodError()
  if (error.code === '23505' && error.message.includes('contact_methods_value_unique_per_user'))
    return new DuplicateContactAcrossContactsError()
  return new Error(error.message)
}

export class ContactsRepositoryImpl implements ContactsRepository {
  async fetchContacts(): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, contact_methods(*)')
      .order('first_name', { ascending: true })

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => contactRowSchema.parse(row))
  }

  async createContact(
    contact: Omit<Contact, 'id' | 'contactMethods'>,
    methods: NewContactMethod[],
  ): Promise<Contact> {
    const { data: contactId, error } = await supabase.rpc('create_contact_with_methods', {
      p_first_name: contact.firstName,
      p_last_name: contact.lastName ?? null,
      p_display_name: contact.displayName ?? null,
      p_methods: methods.map(method => ({
        method_type: method.methodType,
        value: resolveMethodValue(method),
        label: method.label ?? null,
        is_primary: method.isPrimary ?? false,
      })),
    })

    if (error)
      throw mapCreateContactError(error)

    const { data: row, error: fetchError } = await supabase
      .from('contacts')
      .select('*, contact_methods(*)')
      .eq('id', contactId)
      .single()

    if (fetchError)
      throw new Error(fetchError.message)

    return contactRowSchema.parse(row)
  }

  async updateContact(
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ): Promise<Contact> {
    const update: Record<string, unknown> = {}
    if (data.firstName !== undefined)
      update.first_name = data.firstName
    if (data.lastName !== undefined)
      update.last_name = data.lastName
    if (data.displayName !== undefined)
      update.display_name = data.displayName

    const { data: row, error } = await supabase
      .from('contacts')
      .update(update)
      .eq('id', id)
      .select('*, contact_methods(*)')
      .single()

    if (error)
      throw new Error(error.message)

    return contactRowSchema.parse(row)
  }

  async deleteContact(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id)

    if (error)
      throw new Error(error.message)
  }
}
