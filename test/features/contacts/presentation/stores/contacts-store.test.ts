import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

const {
  mockFetchContacts,
  mockCreateContact,
  mockUpdateContact,
  mockDeleteContact,
  mockAddMethod,
  mockRemoveMethod,
  mockUpdateMethod,
} = vi.hoisted(() => ({
  mockFetchContacts: vi.fn(),
  mockCreateContact: vi.fn(),
  mockUpdateContact: vi.fn(),
  mockDeleteContact: vi.fn(),
  mockAddMethod: vi.fn(),
  mockRemoveMethod: vi.fn(),
  mockUpdateMethod: vi.fn(),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: mockFetchContacts,
    createContact: mockCreateContact,
    updateContact: mockUpdateContact,
    deleteContact: mockDeleteContact,
  })),
}))

vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: mockAddMethod,
    removeMethod: mockRemoveMethod,
    updateMethod: mockUpdateMethod,
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

  describe('updateContact', () => {
    it('should update contact in local array and re-sort', async () => {
      const updatedAnna = { ...mockContacts[0]!, firstName: 'Zara' }
      mockFetchContacts.mockResolvedValue([...mockContacts])
      mockUpdateContact.mockResolvedValue(updatedAnna)

      const store = useContactsStore()
      await store.loadContacts()
      await store.updateContact('1', { firstName: 'Zara' })

      const idx = store.contacts.findIndex(c => c.id === '1')
      expect(store.contacts[idx]!.firstName).toBe('Zara')
      // Bob comes before Zara alphabetically
      expect(store.contacts[0]!.firstName).toBe('Bob')
    })

    it('should call repository with correct args', async () => {
      mockFetchContacts.mockResolvedValue([...mockContacts])
      mockUpdateContact.mockResolvedValue({ ...mockContacts[0]!, displayName: 'Annie' })

      const store = useContactsStore()
      await store.loadContacts()
      await store.updateContact('1', { displayName: 'Annie' })

      expect(mockUpdateContact).toHaveBeenCalledWith('1', { displayName: 'Annie' })
    })
  })

  describe('deleteContact', () => {
    it('should remove contact from local array', async () => {
      mockFetchContacts.mockResolvedValue([...mockContacts])
      mockDeleteContact.mockResolvedValue(undefined)

      const store = useContactsStore()
      await store.loadContacts()
      expect(store.contacts).toHaveLength(2)

      await store.deleteContact('1')
      expect(store.contacts).toHaveLength(1)
      expect(store.contacts[0]!.id).toBe('2')
    })
  })

  describe('addMethodToContact', () => {
    it('should add method to the correct contact in local array', async () => {
      mockFetchContacts.mockResolvedValue([{ ...mockContacts[0]!, contactMethods: [] }])
      const newMethod = {
        id: 'method-new',
        contactId: '1',
        methodType: 'phone' as const,
        value: '+41 79 000 00 00',
        label: null,
        isPrimary: true,
      }
      mockAddMethod.mockResolvedValue(newMethod)

      const store = useContactsStore()
      await store.loadContacts()
      await store.addMethodToContact('1', {
        methodType: 'phone',
        value: '+41 79 000 00 00',
        isPrimary: true,
      })

      expect(store.contacts[0]!.contactMethods).toHaveLength(1)
      expect(store.contacts[0]!.contactMethods[0]!.value).toBe('+41 79 000 00 00')
    })
  })

  describe('updateMethodOnContact', () => {
    it('should update the method on the correct contact', async () => {
      mockFetchContacts.mockResolvedValue([mockContacts[1]!])
      const updatedMethod = { ...mockPhoneMethod, value: '+41 79 555 55 55' }
      mockUpdateMethod.mockResolvedValue(updatedMethod)

      const store = useContactsStore()
      await store.loadContacts()
      await store.updateMethodOnContact('2', 'method-1', { value: '+41 79 555 55 55' })

      expect(store.contacts[0]!.contactMethods[0]!.value).toBe('+41 79 555 55 55')
    })
  })

  describe('removeMethodFromContact', () => {
    it('should remove the method from the correct contact', async () => {
      mockFetchContacts.mockResolvedValue([mockContacts[1]!])
      mockRemoveMethod.mockResolvedValue(undefined)

      const store = useContactsStore()
      await store.loadContacts()
      expect(store.contacts[0]!.contactMethods).toHaveLength(1)

      await store.removeMethodFromContact('2', 'method-1')
      expect(store.contacts[0]!.contactMethods).toHaveLength(0)
    })
  })
})
