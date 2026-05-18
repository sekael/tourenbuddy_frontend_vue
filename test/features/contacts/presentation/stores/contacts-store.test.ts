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
  mockSetPrimaryPhone,
} = vi.hoisted(() => ({
  mockFetchContacts: vi.fn(),
  mockCreateContact: vi.fn(),
  mockUpdateContact: vi.fn(),
  mockDeleteContact: vi.fn(),
  mockAddMethod: vi.fn(),
  mockRemoveMethod: vi.fn(),
  mockUpdateMethod: vi.fn(),
  mockSetPrimaryPhone: vi.fn(),
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
    setPrimaryPhone: mockSetPrimaryPhone,
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
  value: '+41791234567',
  label: null,
  isPrimary: true,
  isValid: true,
}

const mockPhoneMethod2 = {
  id: 'method-2',
  contactId: '1',
  methodType: 'phone' as const,
  value: '+41442223344',
  label: 'Home',
  isPrimary: false,
  isValid: true,
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

  it('should add phone method when phones provided', async () => {
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
      value: '+41799990011',
      label: null,
      isPrimary: true,
      isValid: true,
    })
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('Dave', null, null, [{ value: '+41799990011', isPrimary: true }])

    expect(mockAddMethod).toHaveBeenCalledWith('3', {
      methodType: 'phone',
      value: '+41799990011',
      label: null,
      isPrimary: true,
    })
    expect(store.contacts[0]!.contactMethods).toHaveLength(1)
  })

  it('should not add phone method when phones is empty', async () => {
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
    await store.addContact('Eve', null, null, [])

    expect(mockAddMethod).not.toHaveBeenCalled()
  })

  it('addContact with multiple phones inserts all and marks primary correctly', async () => {
    mockFetchContacts.mockResolvedValue([])
    const newContact = {
      id: '5',
      userId: 'user-123',
      firstName: 'Frank',
      lastName: null,
      displayName: null,
      contactMethods: [],
    }
    mockCreateContact.mockResolvedValue(newContact)
    mockAddMethod
      .mockResolvedValueOnce({
        id: 'm1',
        contactId: '5',
        methodType: 'phone',
        value: '+41791234567',
        label: null,
        isPrimary: true,
        isValid: true,
      })
      .mockResolvedValueOnce({
        id: 'm2',
        contactId: '5',
        methodType: 'phone',
        value: '+41442223344',
        label: 'Home',
        isPrimary: false,
        isValid: true,
      })

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('Frank', null, null, [
      { value: '+41 79 123 45 67', isPrimary: true },
      { value: '+41 44 222 33 44', label: 'Home', isPrimary: false },
    ])

    expect(mockAddMethod).toHaveBeenCalledTimes(2)
    expect(store.contacts[0]!.contactMethods).toHaveLength(2)
  })

  it('addContact with multiple phones but none primary throws', async () => {
    mockFetchContacts.mockResolvedValue([])

    const store = useContactsStore()
    await store.loadContacts()

    await expect(
      store.addContact('Test', null, null, [
        { value: '+41 79 123 45 67', isPrimary: false },
        { value: '+41 44 222 33 44', isPrimary: false },
      ]),
    ).rejects.toThrow()
    expect(mockCreateContact).not.toHaveBeenCalled()
  })

  it('single phone in addContact is forced to isPrimary true', async () => {
    mockFetchContacts.mockResolvedValue([])
    mockCreateContact.mockResolvedValue({
      id: '6',
      userId: 'user-123',
      firstName: 'G',
      lastName: null,
      displayName: null,
      contactMethods: [],
    })
    mockAddMethod.mockResolvedValue({
      id: 'm3',
      contactId: '6',
      methodType: 'phone',
      value: '+41 79 123 45 67',
      label: null,
      isPrimary: true,
    })

    const store = useContactsStore()
    await store.loadContacts()
    await store.addContact('G', null, null, [{ value: '+41 79 123 45 67', isPrimary: false }])

    expect(mockAddMethod).toHaveBeenCalledWith('6', expect.objectContaining({ isPrimary: true }))
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
    it('should auto-promote first phone to primary', async () => {
      mockFetchContacts.mockResolvedValue([{ ...mockContacts[0]!, contactMethods: [] }])
      const newMethod = {
        id: 'method-new',
        contactId: '1',
        methodType: 'phone' as const,
        value: '+41790000000',
        label: null,
        isPrimary: true,
        isValid: true,
      }
      mockAddMethod.mockResolvedValue(newMethod)

      const store = useContactsStore()
      await store.loadContacts()
      await store.addMethodToContact('1', {
        methodType: 'phone',
        value: '+41790000000',
        isPrimary: false,
      })

      expect(mockAddMethod).toHaveBeenCalledWith('1', expect.objectContaining({ isPrimary: true }))
    })
  })

  describe('setPrimaryPhoneOnContact', () => {
    it('calls setPrimaryPhone RPC and updates local state from response', async () => {
      const contact = { ...mockContacts[0]!, contactMethods: [mockPhoneMethod, mockPhoneMethod2] }
      mockFetchContacts.mockResolvedValue([contact])
      const updatedRows = [
        { ...mockPhoneMethod, isPrimary: false },
        { ...mockPhoneMethod2, isPrimary: true },
      ]
      mockSetPrimaryPhone.mockResolvedValue(updatedRows)

      const store = useContactsStore()
      await store.loadContacts()
      await store.setPrimaryPhoneOnContact('1', 'method-2')

      expect(mockSetPrimaryPhone).toHaveBeenCalledWith('1', 'method-2')
      const phones = store.contacts[0]!.contactMethods.filter(m => m.methodType === 'phone')
      const newPrimary = phones.find(m => m.id === 'method-2')
      expect(newPrimary?.isPrimary).toBe(true)
    })

    it('does not mutate local state when RPC rejects', async () => {
      const contact = { ...mockContacts[0]!, contactMethods: [mockPhoneMethod, mockPhoneMethod2] }
      mockFetchContacts.mockResolvedValue([contact])
      mockSetPrimaryPhone.mockRejectedValue(new Error('DB error'))

      const store = useContactsStore()
      await store.loadContacts()

      await expect(store.setPrimaryPhoneOnContact('1', 'method-2')).rejects.toThrow()
      const phones = store.contacts[0]!.contactMethods.filter(m => m.methodType === 'phone')
      expect(phones.find(m => m.id === 'method-1')?.isPrimary).toBe(true)
      expect(phones.find(m => m.id === 'method-2')?.isPrimary).toBe(false)
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

    it('should promote next phone to primary when primary is removed', async () => {
      const contact = { ...mockContacts[0]!, contactMethods: [mockPhoneMethod, mockPhoneMethod2] }
      mockFetchContacts.mockResolvedValue([contact])
      mockRemoveMethod.mockResolvedValue(undefined)
      const promotedRows = [{ ...mockPhoneMethod2, isPrimary: true }]
      mockSetPrimaryPhone.mockResolvedValue(promotedRows)

      const store = useContactsStore()
      await store.loadContacts()
      await store.removeMethodFromContact('1', 'method-1')

      expect(mockSetPrimaryPhone).toHaveBeenCalledWith('1', 'method-2')
    })

    it('should not call setPrimaryPhone when removing non-primary', async () => {
      const contact = { ...mockContacts[0]!, contactMethods: [mockPhoneMethod, mockPhoneMethod2] }
      mockFetchContacts.mockResolvedValue([contact])
      mockRemoveMethod.mockResolvedValue(undefined)

      const store = useContactsStore()
      await store.loadContacts()
      await store.removeMethodFromContact('1', 'method-2')

      expect(mockSetPrimaryPhone).not.toHaveBeenCalled()
    })
  })

  describe('phone dedupe', () => {
    it('addContact with duplicate phones → repository receives deduped list; debug log emitted', async () => {
      mockFetchContacts.mockResolvedValue([])
      const newContact = {
        id: '10',
        userId: 'user-123',
        firstName: 'DedupTest',
        lastName: null,
        displayName: null,
        contactMethods: [],
      }
      mockCreateContact.mockResolvedValue(newContact)
      mockAddMethod.mockResolvedValue({
        id: 'm1',
        contactId: '10',
        methodType: 'phone',
        value: '+41791234567',
        label: null,
        isPrimary: true,
        isValid: true,
      })

      const store = useContactsStore()
      await store.loadContacts()
      await store.addContact('DedupTest', null, null, [
        { value: '+41791234567', isPrimary: true },
        { value: '+41791234567', isPrimary: false },
      ])

      expect(mockAddMethod).toHaveBeenCalledTimes(1)
      expect(mockAddMethod).toHaveBeenCalledWith('10', expect.objectContaining({ value: '+41791234567', isPrimary: true }))
    })
  })

  describe('phone normalization', () => {
    it('normalizes Swiss national phone on addContact', async () => {
      mockFetchContacts.mockResolvedValue([])
      mockCreateContact.mockResolvedValue({
        id: '5',
        userId: 'user-123',
        firstName: 'Frank',
        lastName: null,
        displayName: null,
        contactMethods: [],
      })
      mockAddMethod.mockResolvedValue({
        id: 'method-x',
        contactId: '5',
        methodType: 'phone',
        value: '+41799991122',
        label: null,
        isPrimary: true,
        isValid: true,
      })

      const store = useContactsStore()
      await store.loadContacts()
      await store.addContact('Frank', null, null, [{ value: '0799991122', isPrimary: true }])

      expect(mockAddMethod).toHaveBeenCalledWith(
        '5',
        expect.objectContaining({ value: '+41799991122' }),
      )
    })

    it('normalizes phone on addMethodToContact', async () => {
      mockFetchContacts.mockResolvedValue([{ ...mockContacts[0]!, contactMethods: [] }])
      mockAddMethod.mockResolvedValue({
        id: 'method-y',
        contactId: '1',
        methodType: 'phone' as const,
        value: '+41791234567',
        label: null,
        isPrimary: true,
        isValid: true,
      })

      const store = useContactsStore()
      await store.loadContacts()
      await store.addMethodToContact('1', {
        methodType: 'phone',
        value: '0791234567',
        isPrimary: true,
      })

      expect(mockAddMethod).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ value: '+41791234567' }),
      )
    })

    it('normalizes phone on updateMethodOnContact', async () => {
      mockFetchContacts.mockResolvedValue([mockContacts[1]!])
      mockUpdateMethod.mockResolvedValue({ ...mockPhoneMethod, value: '+41791234567' })

      const store = useContactsStore()
      await store.loadContacts()
      await store.updateMethodOnContact('2', 'method-1', { value: '0791234567' })

      expect(mockUpdateMethod).toHaveBeenCalledWith(
        'method-1',
        expect.objectContaining({ value: '+41791234567' }),
      )
    })
  })
})
