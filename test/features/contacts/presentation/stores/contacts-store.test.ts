import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const { mockFetchContacts, mockCreateContact } = vi.hoisted(() => ({
  mockFetchContacts: vi.fn(),
  mockCreateContact: vi.fn(),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: mockFetchContacts,
    createContact: mockCreateContact,
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    isAuthenticated: true,
    currentUser: { id: 'user-123' },
  }),
}))

const mockContacts = [
  { id: '1', userId: 'user-123', firstName: 'Anna', lastName: null, displayName: null },
  { id: '2', userId: 'user-123', firstName: 'Bob', lastName: 'Smith', displayName: 'Bobby' },
]

describe('useContactsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should load contacts from repository', async () => {
    mockFetchContacts.mockResolvedValue(mockContacts)

    const store = useContactsStore()
    await store.loadContacts()

    expect(store.contacts).toEqual(mockContacts)
    expect(store.isLoading).toBe(false)
  })

  it('should add and sort contacts by firstName', async () => {
    mockFetchContacts.mockResolvedValue([mockContacts[1]!])
    mockCreateContact.mockResolvedValue(mockContacts[0])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('Anna')

    expect(store.contacts[0]!.firstName).toBe('Anna')
    expect(store.contacts[1]!.firstName).toBe('Bob')
  })

  it('should trim contact name inputs', async () => {
    mockCreateContact.mockResolvedValue({
      id: '3',
      userId: 'user-123',
      firstName: 'Charlie',
      lastName: null,
      displayName: null,
    })
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('  Charlie  ', '  ', null)

    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Charlie', lastName: null }),
    )
  })

  it('should clear contacts', () => {
    const store = useContactsStore()
    store.contacts = [...mockContacts]
    store.clear()

    expect(store.contacts).toHaveLength(0)
  })
})
