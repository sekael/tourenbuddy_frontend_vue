import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { ContactMethodsRepositoryImpl } from '@/features/contacts/data/repositories/contact-methods-repository-impl'
import { ContactsRepositoryImpl } from '@/features/contacts/data/repositories/contacts-repository-impl'

const repository = new ContactsRepositoryImpl()
const contactMethodsRepository = new ContactMethodsRepositoryImpl()

export const useContactsStore = defineStore('contacts', () => {
  const logger = useLogger('ContactsStore')
  const authStore = useAuthStore()

  const contacts = ref<Contact[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadContacts() {
    if (!authStore.isAuthenticated)
      return

    isLoading.value = true
    error.value = null

    try {
      contacts.value = await repository.fetchContacts()
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contacts'
      error.value = message
      logger.error('Failed to load contacts', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function addContact(
    firstName: string,
    lastName?: string | null,
    displayName?: string | null,
    phoneNumber?: string | null,
  ) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const contact = await repository.createContact({
      userId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      displayName: displayName?.trim() || null,
    })

    if (phoneNumber?.trim()) {
      const method = await contactMethodsRepository.addMethod(contact.id, {
        methodType: 'phone',
        value: phoneNumber.trim(),
        isPrimary: true,
      })
      contact.contactMethods.push(method)
    }

    contacts.value = [...contacts.value, contact].sort((a, b) =>
      a.firstName.localeCompare(b.firstName),
    )
  }

  async function updateContact(
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ) {
    const updated = await repository.updateContact(id, data)
    contacts.value = contacts.value
      .map(c => (c.id === id ? updated : c))
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
  }

  async function deleteContact(id: string) {
    await repository.deleteContact(id)
    contacts.value = contacts.value.filter(c => c.id !== id)
  }

  async function addMethodToContact(
    contactId: string,
    method: NewContactMethod,
  ): Promise<ContactMethod> {
    const newMethod = await contactMethodsRepository.addMethod(contactId, method)
    contacts.value = contacts.value.map(c =>
      c.id === contactId ? { ...c, contactMethods: [...c.contactMethods, newMethod] } : c,
    )
    return newMethod
  }

  async function updateMethodOnContact(
    contactId: string,
    methodId: string,
    data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>,
  ) {
    const updated = await contactMethodsRepository.updateMethod(methodId, data)
    contacts.value = contacts.value.map(c =>
      c.id === contactId
        ? { ...c, contactMethods: c.contactMethods.map(m => (m.id === methodId ? updated : m)) }
        : c,
    )
  }

  async function removeMethodFromContact(contactId: string, methodId: string) {
    await contactMethodsRepository.removeMethod(methodId)
    contacts.value = contacts.value.map(c =>
      c.id === contactId
        ? { ...c, contactMethods: c.contactMethods.filter(m => m.id !== methodId) }
        : c,
    )
  }

  function clear() {
    contacts.value = []
    error.value = null
  }

  return {
    contacts,
    isLoading,
    error,
    loadContacts,
    addContact,
    updateContact,
    deleteContact,
    addMethodToContact,
    updateMethodOnContact,
    removeMethodFromContact,
    clear,
  }
})
