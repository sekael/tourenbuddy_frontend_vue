import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'

export interface NewContactMethod {
  methodType: 'phone' | 'email'
  value: string
  label?: string | null
  isPrimary?: boolean
}

/** Abstract repository interface for contact method operations. */
export interface ContactMethodsRepository {
  addMethod: (contactId: string, method: NewContactMethod) => Promise<ContactMethod>
  removeMethod: (methodId: string) => Promise<void>
  updateMethod: (
    id: string,
    data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>,
  ) => Promise<ContactMethod>
  setPrimaryPhone: (contactId: string, methodId: string) => Promise<ContactMethod[]>
}
