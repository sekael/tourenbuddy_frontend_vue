import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { ContactMethodsRepositoryImpl } from '@/features/contacts/data/repositories/contact-methods-repository-impl'
import { ContactsRepositoryImpl } from '@/features/contacts/data/repositories/contacts-repository-impl'

export interface PhoneEntry {
  value: string
  label?: string | null
  isPrimary: boolean
}

function normalizePhoneValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed)
    return trimmed
  const result = normalizePhone(trimmed)
  return result.ok ? result.value : trimmed
}

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
    phones?: PhoneEntry[],
  ) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    const phoneList = phones ?? []

    if (phoneList.length > 1) {
      const primaryCount = phoneList.filter(p => p.isPrimary).length
      if (primaryCount !== 1)
        throw new Error('Exactly one phone must be marked as primary when adding multiple phones')
    }

    const contact = await repository.createContact({
      userId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      displayName: displayName?.trim() || null,
    })

    for (const phone of phoneList) {
      const normalized = normalizePhoneValue(phone.value)
      if (!normalized)
        continue
      const isPrimary = phoneList.length === 1 ? true : phone.isPrimary
      const method = await contactMethodsRepository.addMethod(contact.id, {
        methodType: 'phone',
        value: normalized,
        label: phone.label ?? null,
        isPrimary,
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
    const contact = contacts.value.find(c => c.id === contactId)
    const existingPhones = contact?.contactMethods.filter(m => m.methodType === 'phone') ?? []

    let normalizedMethod: NewContactMethod = method
    if (method.methodType === 'phone') {
      const normalized = normalizePhoneValue(method.value)
      normalizedMethod = { ...method, value: normalized || method.value }
    }

    if (method.methodType === 'phone') {
      if (existingPhones.length === 0) {
        normalizedMethod = { ...normalizedMethod, isPrimary: true }
      }
      else if (method.isPrimary) {
        const newMethod = await contactMethodsRepository.addMethod(contactId, {
          ...normalizedMethod,
          isPrimary: false,
        })
        const updatedRows = await contactMethodsRepository.setPrimaryPhone(contactId, newMethod.id)
        contacts.value = contacts.value.map(c =>
          c.id === contactId
            ? {
                ...c,
                contactMethods: [
                  ...c.contactMethods.filter(m => m.methodType !== 'phone'),
                  ...updatedRows,
                ],
              }
            : c,
        )
        return updatedRows.find(r => r.id === newMethod.id)!
      }
    }

    const newMethod = await contactMethodsRepository.addMethod(contactId, normalizedMethod)
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
    const contact = contacts.value.find(c => c.id === contactId)
    const existingMethod = contact?.contactMethods.find(m => m.id === methodId)
    const isPhoneMethod = existingMethod?.methodType === 'phone' || data.methodType === 'phone'

    const normalizedData
      = isPhoneMethod && data.value !== undefined
        ? { ...data, value: normalizePhoneValue(data.value) || data.value }
        : data

    if (isPhoneMethod && data.isPrimary === true && existingMethod && !existingMethod.isPrimary) {
      const updatedRows = await contactMethodsRepository.setPrimaryPhone(contactId, methodId)
      contacts.value = contacts.value.map(c =>
        c.id === contactId
          ? {
              ...c,
              contactMethods: [
                ...c.contactMethods.filter(m => m.methodType !== 'phone'),
                ...updatedRows,
              ],
            }
          : c,
      )
      return
    }

    const updated = await contactMethodsRepository.updateMethod(methodId, normalizedData)
    contacts.value = contacts.value.map(c =>
      c.id === contactId
        ? { ...c, contactMethods: c.contactMethods.map(m => (m.id === methodId ? updated : m)) }
        : c,
    )
  }

  async function setPrimaryPhoneOnContact(contactId: string, methodId: string) {
    const updatedRows = await contactMethodsRepository.setPrimaryPhone(contactId, methodId)
    contacts.value = contacts.value.map(c =>
      c.id === contactId
        ? {
            ...c,
            contactMethods: [
              ...c.contactMethods.filter(m => m.methodType !== 'phone'),
              ...updatedRows,
            ],
          }
        : c,
    )
  }

  async function removeMethodFromContact(contactId: string, methodId: string) {
    const contact = contacts.value.find(c => c.id === contactId)
    const removingMethod = contact?.contactMethods.find(m => m.id === methodId)
    const isRemovingPrimary = removingMethod?.methodType === 'phone' && removingMethod.isPrimary

    await contactMethodsRepository.removeMethod(methodId)

    contacts.value = contacts.value.map(c =>
      c.id === contactId
        ? { ...c, contactMethods: c.contactMethods.filter(m => m.id !== methodId) }
        : c,
    )

    if (isRemovingPrimary) {
      const updatedContact = contacts.value.find(c => c.id === contactId)
      const remainingPhones
        = updatedContact?.contactMethods.filter(m => m.methodType === 'phone') ?? []
      if (remainingPhones.length > 0) {
        try {
          await setPrimaryPhoneOnContact(contactId, remainingPhones[0]!.id)
        }
        catch (err) {
          logger.error('Failed to promote next phone to primary after removal', err)
        }
      }
    }
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
    setPrimaryPhoneOnContact,
    removeMethodFromContact,
    clear,
  }
})
