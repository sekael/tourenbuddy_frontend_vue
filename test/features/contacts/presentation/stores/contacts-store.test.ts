import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const { mockFetchContacts, mockCreateContact, mockAddMethod } = vi.hoisted(() => ({
  mockFetchContacts: vi.fn(),
  mockCreateContact: vi.fn(),
  mockAddMethod: vi.fn(),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: mockFetchContacts,
    createContact: mockCreateContact,
  })),
}))

vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: mockAddMethod,
    removeMethod: vi.fn(),
  })),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    isAuthenticated: true,
    currentUser: { id: 'user-123' },
  }),
}))

const mockPhoneMethod = {
  id: 'method-1',
  contactId: '1',
  methodType: 'phone' as const,
  value: '+41 79 123 45 67',
  label: null,
  isPrimary: true,
}

const mockContacts = [
  {
    id: '1',
    userId: 'user-123',
    firstName: 'Anna',
    lastName: null,
    displayName: null,
    contactMethods: [],
  },
  {
    id: '2',
    userId: 'user-123',
    firstName: 'Bob',
    lastName: 'Smith',
    displayName: 'Bobby',
    contactMethods: [mockPhoneMethod],
  },
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
    mockCreateContact.mockResolvedValue({ ...mockContacts[0]!, contactMethods: [] })

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
      contactMethods: [],
    })
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('  Charlie  ', '  ', null)

    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Charlie', lastName: null }),
    )
  })

  it('should add phone method when phoneNumber provided', async () => {
    const newContact = {
      id: '3',
      userId: 'user-123',
      firstName: 'Dave',
      lastName: null,
      displayName: null,
      contactMethods: [],
    }
    mockCreateContact.mockResolvedValue(newContact)
    mockAddMethod.mockResolvedValue({
      id: 'method-2',
      contactId: '3',
      methodType: 'phone',
      value: '+41 79 999 00 11',
      label: null,
      isPrimary: true,
    })
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('Dave', null, null, '+41 79 999 00 11')

    expect(mockAddMethod).toHaveBeenCalledWith('3', {
      methodType: 'phone',
      value: '+41 79 999 00 11',
      isPrimary: true,
    })
    expect(store.contacts[0]!.contactMethods).toHaveLength(1)
  })

  it('should not add phone method when phoneNumber is empty', async () => {
    mockCreateContact.mockResolvedValue({
      id: '4',
      userId: 'user-123',
      firstName: 'Eve',
      lastName: null,
      displayName: null,
      contactMethods: [],
    })
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('Eve', null, null, '')

    expect(mockAddMethod).not.toHaveBeenCalled()
  })

  it('should clear contacts', () => {
    const store = useContactsStore()
    store.contacts = [...mockContacts]
    store.clear()

    expect(store.contacts).toHaveLength(0)
  })
})
