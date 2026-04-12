import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type {
  ContactMethodsRepository,
  NewContactMethod,
} from '@/features/contacts/domain/repositories/contact-methods-repository'
import { supabase } from '@/core/utils/supabase'
import { contactMethodRowSchema } from '@/features/contacts/data/models/contact-method-schema'

export class ContactMethodsRepositoryImpl implements ContactMethodsRepository {
  async addMethod(contactId: string, method: NewContactMethod): Promise<ContactMethod> {
    const { data, error } = await supabase
      .from('contact_methods')
      .insert({
        contact_id: contactId,
        method_type: method.methodType,
        value: method.value,
        label: method.label ?? null,
        is_primary: method.isPrimary ?? false,
      })
      .select()
      .single()

    if (error)
      throw new Error(error.message)

    return contactMethodRowSchema.parse(data)
  }

  async removeMethod(methodId: string): Promise<void> {
    const { error } = await supabase.from('contact_methods').delete().eq('id', methodId)

    if (error)
      throw new Error(error.message)
  }
}
