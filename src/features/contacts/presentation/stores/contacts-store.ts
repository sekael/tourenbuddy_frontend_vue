import type { WriteQueueEntry } from '@/core/offline/write-queue'
import type { Contact } from '@/features/contacts/domain/entities/contact'
import type { ContactMethod } from '@/features/contacts/domain/entities/contact-method'
import type { NewContactMethod } from '@/features/contacts/domain/repositories/contact-methods-repository'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { flushThenRefetch } from '@/core/offline/reconnect'
import { PermanentReplayError, registerReplay } from '@/core/offline/replay'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { dedupePhones } from '@/features/contacts/core/utils/dedupe'
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

/** Serializable replay payload for a contact create/update — the desired aggregate to re-run (DC3). */
interface ContactWritePayload {
  contact: Contact
}

export const useContactsStore = defineStore('contacts', () => {
  const logger = useLogger('ContactsStore')
  const authStore = useAuthStore()

  const contacts = ref<Contact[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /**
   * Settle signal for name-resolution render gates: `true` once `loadContacts` has run
   * to completion, success OR failure. `isLoading` cannot serve — it reads `false`
   * before the first load starts, so a gate on it settles prematurely and flips.
   */
  const hasLoaded = ref(false)

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
      hasLoaded.value = true
    }
  }

  const cacheKey = () => `contacts:${authStore.currentUser?.id}`

  function sortByName(rows: Contact[]): Contact[] {
    return [...rows].sort((a, b) => a.firstName.localeCompare(b.firstName))
  }

  /** Insert-or-replace a contact by id (idempotent against a racing realtime refetch), re-sorted. */
  function replaceContact(rows: Contact[], next: Contact): Contact[] {
    return sortByName([...rows.filter(c => c.id !== next.id), next])
  }

  /** Replay a queued contact write on reconnect (DC3): one idempotent aggregate call by op. */
  async function replayContactWrite(entry: WriteQueueEntry): Promise<void> {
    const { contact } = entry.payload as ContactWritePayload
    if (entry.op === 'delete') {
      await repository.deleteContact(entry.entityId)
      return
    }
    if (entry.op === 'create') {
      await repository.createContactFull(contact)
      return
    }
    // update: LWW (DC5) — a server row newer than our baseline won; don't clobber it.
    const serverTs = await repository.getContactUpdatedAt(entry.entityId)
    if (serverTs === null)
      throw new PermanentReplayError('contact was deleted on the server')
    if (entry.baseUpdatedAt && new Date(serverTs) > new Date(entry.baseUpdatedAt))
      throw new PermanentReplayError('contact changed on the server since this edit (LWW loser)')
    const updated = await repository.updateContactFull(contact)
    if (updated === null)
      throw new PermanentReplayError('contact was deleted on the server')
  }
  registerReplay('contact', replayContactWrite)

  /** Idempotent create of the whole aggregate. Online runs it + refetches canonical; offline queues it. */
  async function createContactAggregate(contact: Contact) {
    return mutate<Contact>({
      run: async () => {
        const created = await repository.createContactFull(contact)
        contacts.value = replaceContact(contacts.value, created)
      },
      intent: { entityId: contact.id, kind: 'contact', op: 'create', payload: { contact } },
      cacheKey: cacheKey(),
      current: contacts.value,
      apply: rows => replaceContact(rows, contact),
      assign: (rows) => { contacts.value = rows },
    })
  }

  /**
   * The single update seam: EVERY contact-field or method mutation builds the full desired
   * aggregate and routes here (contacts' "Path Y") — so they queue, replay, coalesce and LWW
   * through one path, online or offline, and the server RPC reconciles the whole method set.
   */
  async function updateContactAggregate(contact: Contact) {
    const existing = contacts.value.find(c => c.id === contact.id) ?? null
    return mutate<Contact>({
      run: async () => {
        const updated = await repository.updateContactFull(contact)
        if (updated === null)
          throw new Error('Contact no longer exists')
        contacts.value = replaceContact(contacts.value, updated)
      },
      intent: {
        entityId: contact.id,
        kind: 'contact',
        op: 'update',
        payload: { contact },
        baseSnapshot: existing,
        baseUpdatedAt: existing?.updatedAt ?? undefined,
      },
      cacheKey: cacheKey(),
      current: contacts.value,
      apply: rows => replaceContact(rows, contact),
      assign: (rows) => { contacts.value = rows },
    })
  }

  async function addContact(
    firstName: string,
    lastName?: string | null,
    displayName?: string | null,
    phones?: PhoneEntry[],
    source: 'manual' | 'import' = 'manual',
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

    const preparedPhones = phoneList
      .map((phone) => {
        const normalized = normalizePhoneValue(phone.value)
        if (!normalized)
          return null
        return { value: normalized, label: phone.label ?? null, isPrimary: phone.isPrimary }
      })
      .filter((p): p is { value: string, label: string | null, isPrimary: boolean } => p !== null)

    if (preparedPhones.length === 1)
      preparedPhones[0]!.isPrimary = true

    const contactId = uuidv4()
    const contactMethods: ContactMethod[] = preparedPhones.map(phone => ({
      id: uuidv4(),
      contactId,
      methodType: 'phone',
      value: phone.value,
      label: phone.label,
      isPrimary: phone.isPrimary,
      isValid: true,
    }))

    return createContactAggregate({
      id: contactId,
      userId,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      displayName: displayName?.trim() || null,
      contactMethods,
      updatedAt: null,
    })
  }

  async function updateContact(
    id: string,
    data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>,
  ) {
    const contact = contacts.value.find(c => c.id === id)
    if (!contact)
      return
    return updateContactAggregate({
      ...contact,
      firstName: data.firstName ?? contact.firstName,
      lastName: data.lastName !== undefined ? data.lastName : contact.lastName,
      displayName: data.displayName !== undefined ? data.displayName : contact.displayName,
    })
  }

  async function deleteContact(id: string) {
    const existing = contacts.value.find(c => c.id === id) ?? null
    return mutate<Contact>({
      run: async () => {
        await repository.deleteContact(id)
        contacts.value = contacts.value.filter(c => c.id !== id)
      },
      intent: { entityId: id, kind: 'contact', op: 'delete', payload: {}, baseSnapshot: existing },
      cacheKey: cacheKey(),
      current: contacts.value,
      apply: rows => rows.filter(c => c.id !== id),
      assign: (rows) => { contacts.value = rows },
    })
  }

  async function addMethodToContact(contactId: string, method: NewContactMethod) {
    const contact = contacts.value.find(c => c.id === contactId)
    if (!contact)
      return
    const isPhone = method.methodType === 'phone'
    const value = isPhone ? (normalizePhoneValue(method.value) || method.value) : method.value
    const existingPhones = contact.contactMethods.filter(m => m.methodType === 'phone')
    // First phone is implicitly primary; an explicitly-primary add demotes the others.
    const makePrimary = isPhone && (existingPhones.length === 0 || method.isPrimary === true)
    const newMethod: ContactMethod = {
      id: uuidv4(),
      contactId,
      methodType: method.methodType,
      value,
      label: method.label ?? null,
      isPrimary: makePrimary,
      isValid: true,
    }
    const base = makePrimary && isPhone
      ? contact.contactMethods.map(m => (m.methodType === 'phone' ? { ...m, isPrimary: false } : m))
      : contact.contactMethods
    return updateContactAggregate({ ...contact, contactMethods: [...base, newMethod] })
  }

  async function updateMethodOnContact(
    contactId: string,
    methodId: string,
    data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>,
  ) {
    const contact = contacts.value.find(c => c.id === contactId)
    const method = contact?.contactMethods.find(m => m.id === methodId)
    if (!contact || !method)
      return
    const isPhone = method.methodType === 'phone'
    const nextValue = data.value !== undefined
      ? (isPhone ? (normalizePhoneValue(data.value) || data.value) : data.value)
      : method.value
    // A promote demotes every other phone (method_type itself is immutable server-side).
    const promote = isPhone && data.isPrimary === true && !method.isPrimary
    const methods = contact.contactMethods.map((m) => {
      if (m.id === methodId) {
        return {
          ...m,
          value: nextValue,
          label: data.label !== undefined ? data.label : m.label,
          isPrimary: promote ? true : (data.isPrimary ?? m.isPrimary),
          isValid: true,
        }
      }
      return promote && m.methodType === 'phone' ? { ...m, isPrimary: false } : m
    })
    return updateContactAggregate({ ...contact, contactMethods: methods })
  }

  async function setPrimaryPhoneOnContact(contactId: string, methodId: string) {
    const contact = contacts.value.find(c => c.id === contactId)
    if (!contact)
      return
    const target = contact.contactMethods.find(m => m.id === methodId)
    if (!target || target.methodType !== 'phone')
      throw new Error('method not found or is not a phone method')
    const methods = contact.contactMethods.map(m =>
      m.methodType === 'phone' ? { ...m, isPrimary: m.id === methodId } : m,
    )
    return updateContactAggregate({ ...contact, contactMethods: methods })
  }

  async function removeMethodFromContact(contactId: string, methodId: string) {
    const contact = contacts.value.find(c => c.id === contactId)
    if (!contact)
      return
    const removing = contact.contactMethods.find(m => m.id === methodId)
    let methods = contact.contactMethods.filter(m => m.id !== methodId)
    // Promote the next phone to primary when we removed the primary one.
    if (removing?.methodType === 'phone' && removing.isPrimary) {
      const idx = methods.findIndex(m => m.methodType === 'phone')
      if (idx >= 0)
        methods = methods.map((m, i) => (i === idx ? { ...m, isPrimary: true } : m))
    }
    return updateContactAggregate({ ...contact, contactMethods: methods })
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
    hasLoaded.value = false
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
    // DC4: drain the write queue BEFORE the reconnect refetch so a replayed offline
    // write lands server-side before the fresh snapshot overwrites the store.
    onSubscribed: () => flushThenRefetch(loadContacts),
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
    hasLoaded,
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
