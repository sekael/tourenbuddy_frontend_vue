import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { dedupePhones } from '@/features/contacts/core/utils/dedupe'
import { ContactMethodsRepositoryImpl } from '@/features/contacts/data/repositories/contact-methods-repository-impl'
import { ContactsRepositoryImpl } from '@/features/contacts/data/repositories/contacts-repository-impl'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

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
    const uid = authStore.currentUser?.id
    if (!uid)
      return

    isLoading.value = true
    error.value = null

    try {
      await cachedLoad(
        `contacts:${uid}`,
        () => repository.fetchContacts(),
        (result) => { contacts.value = result },
      )
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
  ) {
    return mutate(async () => {
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

      const contact = await repository.createContact(
        {
          userId,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
          displayName: displayName?.trim() || null,
        },
        preparedPhones.map(phone => ({
          methodType: 'phone',
          value: phone.value,
          label: phone.label,
          isPrimary: phone.isPrimary,
        })),
      )

      // Insert-or-replace by id, not a blind append: on a slow network the realtime
      // INSERT can trigger a refetch that already put this row into contacts.value
      // before createContact's response returns here — appending again would show it
      // twice until the next reload. Dropping any existing copy first is idempotent.
      contacts.value = [...contacts.value.filter(c => c.id !== contact.id), contact].sort((a, b) =>
        a.firstName.localeCompare(b.firstName),
      )
    })
  }

  async function updateContact(
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ) {
    return mutate(async () => {
      const updated = await repository.updateContact(id, data)
      contacts.value = contacts.value
        .map(c => (c.id === id ? updated : c))
        .sort((a, b) => a.firstName.localeCompare(b.firstName))
    })
  }

  async function deleteContact(id: string) {
    return mutate(async () => {
      await repository.deleteContact(id)
      contacts.value = contacts.value.filter(c => c.id !== id)
    })
  }

  async function addMethodToContact(
    contactId: string,
    method: NewContactMethod,
  ): Promise<ContactMethod | undefined> {
    return mutate(async () => {
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
    })
  }

  async function updateMethodOnContact(
    contactId: string,
    methodId: string,
    data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>,
  ) {
    return mutate(async () => {
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
    })
  }

  async function setPrimaryPhoneOnContact(contactId: string, methodId: string) {
    return mutate(async () => {
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
    })
  }

  async function removeMethodFromContact(contactId: string, methodId: string) {
    return mutate(async () => {
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
    })
  }

  function findContactByMethodValue(
    methodType: 'phone' | 'email',
    value: string,
    exceptContactId?: string,
  ): Contact | undefined {
    const normalized = methodType === 'phone' ? normalizePhoneValue(value) || value : value
    return contacts.value.find(
      c =>
        c.id !== exceptContactId
        && c.contactMethods.some((m) => {
          if (m.methodType !== methodType)
            return false
          // Normalize BOTH sides: a contact seeded/imported with a non-E.164 phone
          // (spaces, local format) would otherwise never match an E.164 query, so a
          // "does this contact already exist?" check misses and a duplicate is created.
          const stored = methodType === 'phone' ? normalizePhoneValue(m.value) || m.value : m.value
          return stored === normalized
        }),
    )
  }

  async function relationshipsForContact(contactId: string): Promise<{ hasPending: boolean, hasFriendship: boolean }> {
    const contact = contacts.value.find(c => c.id === contactId)
    if (!contact)
      return { hasPending: false, hasFriendship: false }

    const phones = contact.contactMethods
      .filter(m => m.methodType === 'phone')
      .map(m => m.value)

    if (phones.length === 0)
      return { hasPending: false, hasFriendship: false }

    const friendshipsStore = useFriendshipsStore()
    const results = await friendshipsStore.findUsersByPhones(phones)

    let hasPending = false
    let hasFriendship = false
    for (const r of results) {
      if (friendshipsStore.friendUserIds.has(r.userId))
        hasFriendship = true
      if (friendshipsStore.pendingRequestUserIds.has(r.userId))
        hasPending = true
    }

    return { hasPending, hasFriendship }
  }

  async function relationshipsForPhone(phone: string): Promise<{ hasPending: boolean, hasFriendship: boolean, userId: string | null }> {
    const friendshipsStore = useFriendshipsStore()
    const userId = await friendshipsStore.findUserByPhone(phone)
    if (!userId)
      return { hasPending: false, hasFriendship: false, userId: null }

    return {
      hasPending: friendshipsStore.pendingRequestUserIds.has(userId),
      hasFriendship: friendshipsStore.friendUserIds.has(userId),
      userId,
    }
  }

  function clear() {
    contacts.value = []
    error.value = null
  }

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `contacts-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [
        { event: '*', table: 'contacts', filter: `user_id=eq.${uid}` },
        { event: '*', table: 'contact_methods', filter: `user_id=eq.${uid}` },
      ]
    },
    onChange: loadContacts,
    onSubscribed: () => loadContacts(),
  })

  watch(
    () => authStore.isAuthenticated,
    (v) => {
      if (!v)
        clear()
    },
  )

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
    relationshipsForContact,
    relationshipsForPhone,
    findContactByMethodValue,
    clear,
  }
})
