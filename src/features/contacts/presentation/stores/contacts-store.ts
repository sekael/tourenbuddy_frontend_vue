import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { dedupeEmails, dedupePhones } from '@/features/contacts/core/utils/dedupe'
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
  return result.ok ? result.e164 : trimmed
}

const PHONE_LABEL_PRIORITY: Record<string, number> = { Mobile: 1, Home: 2, Work: 3 }

function resolvePrimaryByLabel(phones: PhoneEntry[]): PhoneEntry[] {
  let bestIdx = 0
  let bestPriority = Number.MAX_SAFE_INTEGER
  for (let i = 0; i < phones.length; i++) {
    const label = phones[i]!.label ?? null
    const priority
      = label !== null
        ? (PHONE_LABEL_PRIORITY[label] ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER
    if (priority < bestPriority) {
      bestPriority = priority
      bestIdx = i
    }
  }
  return phones.map((p, i) => ({ ...p, isPrimary: i === bestIdx }))
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
    source: 'manual' | 'import' = 'manual',
    emails?: string[],
  ) {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    let phoneList = phones ?? []

    // Dedupe by value before any further processing (belt-and-suspenders)
    const beforeDedupeCount = phoneList.length
    phoneList = dedupePhones(phoneList)
    if (phoneList.length < beforeDedupeCount) {
      logger.debug(`addContact: collapsed ${beforeDedupeCount - phoneList.length} duplicate phone(s) for "${firstName}"`)
    }

    if (phoneList.length > 1) {
      if (source === 'import') {
        phoneList = resolvePrimaryByLabel(phoneList)
      }
      else {
        const primaryCount = phoneList.filter(p => p.isPrimary).length
        if (primaryCount !== 1)
          throw new Error('Exactly one phone must be marked as primary when adding multiple phones')
      }
    }

    const contact = await repository.createContact({
      userId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      displayName: displayName?.trim() || null,
    })

    const preparedPhones = phoneList
      .map((phone) => {
        const normalized = normalizePhoneValue(phone.value)
        if (!normalized)
          return null
        return {
          value: normalized,
          label: phone.label ?? null,
          isPrimary: phone.isPrimary,
        }
      })
      .filter((p): p is { value: string, label: string | null, isPrimary: boolean } => p !== null)

    if (preparedPhones.length === 1)
      preparedPhones[0]!.isPrimary = true

    // Insert primary first so any DB-side "first phone becomes primary" rule
    // aligns with the caller-selected primary. Preserve original order otherwise.
    const primaryIdx = preparedPhones.findIndex(p => p.isPrimary)
    const orderedPhones
      = primaryIdx > 0
        ? [preparedPhones[primaryIdx]!, ...preparedPhones.filter((_, i) => i !== primaryIdx)]
        : preparedPhones

    for (const phone of orderedPhones) {
      const method = await contactMethodsRepository.addMethod(contact.id, {
        methodType: 'phone',
        value: phone.value,
        label: phone.label,
        isPrimary: phone.isPrimary,
      })
      contact.contactMethods.push(method)
    }

    // Insert emails (defense-in-depth dedupe)
    const dedupedEmails = dedupeEmails(emails ?? [])
    for (let i = 0; i < dedupedEmails.length; i++) {
      const method = await contactMethodsRepository.addMethod(contact.id, {
        methodType: 'email',
        value: dedupedEmails[i]!,
        label: null,
        isPrimary: i === 0,
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
