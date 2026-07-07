import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type {
  ContactMethodsRepository,
  NewContactMethod,
} from '@/features/contacts/domain/repositories/contact-methods-repository'
import { DuplicateContactAcrossContactsError, DuplicateContactMethodError } from '@/core/exceptions'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { supabase } from '@/core/utils/supabase'
import { contactMethodRowSchema } from '@/features/contacts/data/models/contact-method-schema'

function mapMethodWriteError(error: { code: string, message: string }): Error {
  if (error.code === '23505' && error.message.includes('contact_methods_unique_per_contact'))
    return new DuplicateContactMethodError()
  if (error.code === '23505' && error.message.includes('contact_methods_value_unique_per_user'))
    return new DuplicateContactAcrossContactsError()
  return new Error(error.message)
}

function resolvePhoneValue(raw: string): string {
  const result = normalizePhone(raw)
  if (!result.ok)
    throw new Error(`Invalid phone number: "${raw}"`)
  return result.e164
}

export class ContactMethodsRepositoryImpl implements ContactMethodsRepository {
  async addMethod(contactId: string, method: NewContactMethod): Promise<ContactMethod> {
    const value = method.methodType === 'phone' ? resolvePhoneValue(method.value) : method.value

    const { data, error } = await supabase
      .from('contact_methods')
      .insert({
        contact_id: contactId,
        method_type: method.methodType,
        value,
        label: method.label ?? null,
        is_primary: method.isPrimary ?? false,
      })
      .select()
      .single()

    if (error)
      throw mapMethodWriteError(error)

    return contactMethodRowSchema.parse(data)
  }

  async removeMethod(methodId: string): Promise<void> {
    const { error } = await supabase.from('contact_methods').delete().eq('id', methodId)

    if (error)
      throw new Error(error.message)
  }

  async updateMethod(
    id: string,
    data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>,
  ): Promise<ContactMethod> {
    const update: Record<string, unknown> = {}
    if (data.methodType !== undefined)
      update.method_type = data.methodType
    if (data.value !== undefined) {
      update.value = data.methodType === 'phone' ? resolvePhoneValue(data.value) : data.value
    }
    if (data.label !== undefined)
      update.label = data.label
    if (data.isPrimary !== undefined)
      update.is_primary = data.isPrimary

    const { data: row, error } = await supabase
      .from('contact_methods')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error)
      throw mapMethodWriteError(error)

    return contactMethodRowSchema.parse(row)
  }

  async setPrimaryPhone(contactId: string, methodId: string): Promise<ContactMethod[]> {
    const { data, error } = await supabase.rpc('set_primary_phone', {
      p_contact_id: contactId,
      p_method_id: methodId,
    })

    if (error)
      throw new Error(error.message)

    return (data as unknown[]).map(row => contactMethodRowSchema.parse(row))
  }
}
