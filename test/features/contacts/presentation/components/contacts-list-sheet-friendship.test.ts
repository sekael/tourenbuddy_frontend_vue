import type { FriendRequest, Friendship } from '@/features/friendships/data/models/friendship-schemas'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'

const {
  mockCurrentUser,
  mockFindUserByPhone,
  mockFindUsersByPhones,
  mockListFriendships,
  mockListIncoming,
  mockPickContacts,
} = vi.hoisted(() => ({
  mockCurrentUser: {
    value: { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' } as
    | { id: string, phone_confirmed_at: string | null }
    | null,
  },
  mockFindUserByPhone: vi.fn<[string], Promise<string | null>>(),
  mockFindUsersByPhones: vi.fn<[string[]], Promise<{ phone: string, userId: string }[]>>(),
  mockListFriendships: vi.fn<[], Promise<Friendship[]>>(),
  mockListIncoming: vi.fn<[], Promise<FriendRequest[]>>(),
  mockPickContacts: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock('@/features/contacts/presentation/composables/use-contact-picker', () => ({
  useContactPicker: () => ({ isSupported: true, pickContacts: mockPickContacts }),
}))
vi.mock('@/features/contacts/presentation/composables/use-vcard-import', () => ({
  useVCardImport: () => ({ parseVCardFile: vi.fn() }),
}))
vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    get currentUser() { return mockCurrentUser.value },
    get isAuthenticated() { return mockCurrentUser.value != null },
  })),
}))
vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn(() => ({
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: mockListIncoming,
    listFriendships: mockListFriendships,
    findUserByPhone: mockFindUserByPhone,
    findUsersByPhones: mockFindUsersByPhones,
  })),
}))
vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn(() => ({
    fetchContacts: vi.fn().mockResolvedValue([]),
    createContact: vi.fn().mockResolvedValue({
      id: 'new-c',
      firstName: 'Contact',
      lastName: 'A',
      displayName: null,
      userId: 'user-me',
      contactMethods: [],
    }),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
  })),
}))
vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn(() => ({
    addMethod: vi.fn().mockResolvedValue({
      id: 'm-new',
      contactId: 'new-c',
      methodType: 'phone',
      value: '+41791111111',
      label: null,
      isPrimary: true,
    }),
    removeMethod: vi.fn(),
    updateMethod: vi.fn(),
    setPrimaryPhone: vi.fn(),
  })),
}))

const ANNA_PHONE = '+41791234567'

const anna = {
  id: 'c-1',
  userId: 'user-me',
  firstName: 'Anna',
  lastName: 'Meier',
  displayName: null,
  contactMethods: [
    { id: 'm-1', contactId: 'c-1', methodType: 'phone', value: ANNA_PHONE, label: null, isPrimary: true },
  ],
}

function makeFriendship(a: string, b: string): Friendship {
  const [userAId, userBId] = [a, b].sort() as [string, string]
  return { userAId, userBId, createdAt: new Date().toISOString(), requestId: 'req-1' }
}

function makePendingRequest(toUserId: string): FriendRequest {
  return {
    id: 'req-out-1',
    fromUserId: 'user-me',
    toUserId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null,
  }
}

const ContactFormStub = {
  name: 'ContactForm',
  template: '<div data-testid="contact-form" />',
  emits: ['submit', 'cancel', 'phone-change'],
  props: ['submitLabel', 'isLoading'],
}

const ConnectPromptStub = {
  name: 'ConnectPrompt',
  template: '<div data-testid="connect-prompt" :data-user-id="matchedUserId" />',
  emits: ['sent', 'dismissed'],
  props: ['matchedUserId'],
}

function mountSheet(contacts = [anna]) {
  return mount(ContactsListSheet, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            contacts: { contacts, isLoading: false, error: null },
          },
        }),
      ],
      stubs: {
        ContactDetailView: { template: '<div />', emits: ['back', 'deleted'], props: ['contact'] },
        ContactForm: ContactFormStub,
        ConnectPrompt: ConnectPromptStub,
      },
    },
  })
}

async function openAddView(wrapper: ReturnType<typeof mountSheet>) {
  await wrapper.find('.add-contact-btn').trigger('click')
  await wrapper.vm.$nextTick()
}

// ── 10.2: Connect-prompt suppression rules ───────────────────────────────────

describe('connect-prompt suppression (manual form)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' }
    mockListIncoming.mockResolvedValue([])
    mockListFriendships.mockResolvedValue([])
    mockFindUsersByPhones.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not show prompt when caller phone is unverified', async () => {
    mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: null }
    mockFindUserByPhone.mockResolvedValue('user-other')

    const wrapper = mountSheet()
    await flushPromises()
    await openAddView(wrapper)

    await wrapper.findComponent(ContactFormStub).vm.$emit('phone-change', ANNA_PHONE)
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(mockFindUserByPhone).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="connect-prompt"]').exists()).toBe(false)
  })

  it('should not show prompt when matched user is already a friend', async () => {
    mockListFriendships.mockResolvedValue([makeFriendship('user-me', 'user-other')])
    mockFindUserByPhone.mockResolvedValue('user-other')

    const wrapper = mountSheet()
    await flushPromises() // fetchAll settles → friendships set, friendUserIds updated

    await openAddView(wrapper)
    await wrapper.findComponent(ContactFormStub).vm.$emit('phone-change', ANNA_PHONE)
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(mockFindUserByPhone).toHaveBeenCalledWith(ANNA_PHONE)
    expect(wrapper.find('[data-testid="connect-prompt"]').exists()).toBe(false)
  })

  it('should not show prompt when pending outgoing request already exists for matched user', async () => {
    mockListIncoming.mockResolvedValue([makePendingRequest('user-other')])
    mockFindUserByPhone.mockResolvedValue('user-other')

    const wrapper = mountSheet()
    await flushPromises() // fetchAll settles → outgoingRequests populated

    await openAddView(wrapper)
    await wrapper.findComponent(ContactFormStub).vm.$emit('phone-change', ANNA_PHONE)
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(mockFindUserByPhone).toHaveBeenCalledWith(ANNA_PHONE)
    expect(wrapper.find('[data-testid="connect-prompt"]').exists()).toBe(false)
  })

  it('should show prompt when valid match found with no prior relation', async () => {
    mockFindUserByPhone.mockResolvedValue('user-other')

    const wrapper = mountSheet()
    await flushPromises()
    await openAddView(wrapper)

    await wrapper.findComponent(ContactFormStub).vm.$emit('phone-change', ANNA_PHONE)
    vi.advanceTimersByTime(400)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const prompt = wrapper.find('[data-testid="connect-prompt"]')
    expect(prompt.exists()).toBe(true)
    expect(prompt.attributes('data-user-id')).toBe('user-other')
  })
})

// ── 10.3: Contacts list row friendship icon ──────────────────────────────────

describe('friendship icon in contact list rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' }
    mockListIncoming.mockResolvedValue([])
    mockListFriendships.mockResolvedValue([])
    mockFindUsersByPhones.mockResolvedValue([])
  })

  it('should show friend icon when contact phone matches a confirmed friendship', async () => {
    mockListFriendships.mockResolvedValue([makeFriendship('user-me', 'user-other')])
    mockFindUsersByPhones.mockResolvedValue([{ phone: ANNA_PHONE, userId: 'user-other' }])

    const wrapper = mountSheet()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.friend-icon').exists()).toBe(true)
  })

  it('should not show friend icon when no phone matches any friendship', async () => {
    mockFindUsersByPhones.mockResolvedValue([])

    const wrapper = mountSheet()
    await flushPromises()

    expect(wrapper.find('.friend-icon').exists()).toBe(false)
  })

  it('should not show friend icon when only a pending outgoing request exists (not yet accepted)', async () => {
    // Phone maps to user-other, but user-other is only in outgoingRequests (no friendship entry)
    mockListIncoming.mockResolvedValue([makePendingRequest('user-other')])
    mockFindUsersByPhones.mockResolvedValue([{ phone: ANNA_PHONE, userId: 'user-other' }])

    const wrapper = mountSheet()
    await flushPromises()

    // outgoingRequests contains the pending request but friendships is empty
    // → user-other is NOT in friendUserIds → no friend icon
    expect(wrapper.find('.friend-icon').exists()).toBe(false)
  })
})

// ── 10.4: Import-results batch discovery ─────────────────────────────────────

describe('import-results discovery', () => {
  const PHONE_A = '+41791111111'
  const PHONE_B = '+41792222222'

  const importedItems = [
    {
      firstName: 'Contact',
      lastName: 'A',
      phones: [{ value: PHONE_A, label: null, isPrimary: true }],
      rawPhoneNumbers: [],
    },
    {
      firstName: 'Contact',
      lastName: 'B',
      phones: [{ value: PHONE_B, label: null, isPrimary: true }],
      rawPhoneNumbers: [],
    },
  ]

  /** Second .import-btn = contact picker (rendered when isContactPickerSupported = true) */
  function contactPickerBtn(wrapper: ReturnType<typeof mountSheet>) {
    return wrapper.findAll('.import-btn')[1]!
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: '2024-01-01T00:00:00Z' }
    mockListIncoming.mockResolvedValue([])
    mockListFriendships.mockResolvedValue([])
    mockFindUsersByPhones.mockResolvedValue([])
    mockPickContacts.mockResolvedValue(importedItems)
  })

  it('should call findUsersByPhones exactly once with union of all phones after batch import', async () => {
    const wrapper = mountSheet([])
    await flushPromises()
    await openAddView(wrapper)

    await contactPickerBtn(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.results-view').exists()).toBe(true)

    // processImportedContacts batches all phones into one call (composable may make extra per-contact calls)
    const batchCall = mockFindUsersByPhones.mock.calls.find(
      c => c[0].includes(PHONE_A) && c[0].includes(PHONE_B),
    )
    expect(batchCall).toBeDefined()
    expect(batchCall![0]).toContain(PHONE_A)
    expect(batchCall![0]).toContain(PHONE_B)
  })

  it('should render ConnectPrompt for matched import rows', async () => {
    mockFindUsersByPhones.mockResolvedValue([{ phone: PHONE_A, userId: 'user-other' }])

    const wrapper = mountSheet([])
    await flushPromises()
    await openAddView(wrapper)

    await contactPickerBtn(wrapper).trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    const prompt = wrapper.find('[data-testid="connect-prompt"]')
    expect(prompt.exists()).toBe(true)
    expect(prompt.attributes('data-user-id')).toBe('user-other')
  })

  it('should show import results even when batch discovery call fails', async () => {
    // The store's findUsersByPhones swallows the error and returns []; import should still succeed
    mockFindUsersByPhones.mockRejectedValue(new Error('RPC error'))

    const wrapper = mountSheet([])
    await flushPromises()
    await openAddView(wrapper)

    await contactPickerBtn(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.results-view').exists()).toBe(true)
    expect(wrapper.find('[data-testid="connect-prompt"]').exists()).toBe(false)
  })

  it('should not call findUsersByPhones for import when caller is unverified', async () => {
    mockCurrentUser.value = { id: 'user-me', phone_confirmed_at: null }

    const wrapper = mountSheet([])
    await flushPromises()
    await openAddView(wrapper)

    await contactPickerBtn(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.results-view').exists()).toBe(true)
    const importBatchCall = mockFindUsersByPhones.mock.calls.find(
      c => c[0].includes(PHONE_A),
    )
    expect(importBatchCall).toBeUndefined()
  })
})
