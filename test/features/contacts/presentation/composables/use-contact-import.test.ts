import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContactImport } from '@/features/contacts/presentation/composables/use-contact-import'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: { id: 'u-1' }, isAuthenticated: true }),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: vi.fn().mockResolvedValue([]),
    createContact: vi.fn().mockImplementation(async (c: { firstName: string }) => ({
      id: `c-${c.firstName}`,
      userId: 'u-1',
      firstName: c.firstName,
      lastName: null,
      displayName: null,
      contactMethods: [],
    })),
  })),
}))

vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: vi.fn().mockImplementation(async (cid: string, m: { value: string }) => ({
      id: `m-${m.value}`,
      contactId: cid,
      methodType: 'phone',
      value: m.value,
      label: null,
      isPrimary: true,
      isValid: true,
    })),
  })),
}))

describe('useContactImport', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('skips contact with phones=0 and rawPhoneNumbers>0; preserves rawPhoneNumbers for inline display', async () => {
    const { importContacts } = useContactImport()
    const results = await importContacts([
      { firstName: 'NoPhone', lastName: null, phones: [], rawPhoneNumbers: ['ext. 1234'] },
    ])

    expect(results[0]!.status).toBe('skipped')
    expect(results[0]!.rawPhoneNumbers).toEqual(['ext. 1234'])
    expect(results[0]!.primaryPhone).toBeNull()
  })

  it('imports valid phones when raw values coexist; rawPhoneNumbers carries discarded for inline display', async () => {
    const { importContacts } = useContactImport()
    const results = await importContacts([
      {
        firstName: 'PartialPhone',
        lastName: null,
        phones: [{ value: '+41791234567', isPrimary: true }],
        rawPhoneNumbers: ['ext. 5678', 'garbage'],
      },
    ])

    expect(results[0]!.status).toBe('imported')
    expect(results[0]!.primaryPhone).toBe('+41791234567')
    expect(results[0]!.rawPhoneNumbers).toEqual(['ext. 5678', 'garbage'])
  })

  it('imports name-only contact when phones=0 and rawPhoneNumbers=0', async () => {
    const { importContacts } = useContactImport()
    const results = await importContacts([
      { firstName: 'NameOnly', lastName: null, phones: [], rawPhoneNumbers: [] },
    ])

    expect(results[0]!.status).toBe('imported')
    expect(results[0]!.primaryPhone).toBeNull()
  })

  it('skips duplicate by name (case-insensitive)', async () => {
    const store = useContactsStore()
    store.contacts = [
      {
        id: '1',
        userId: 'u-1',
        firstName: 'Anna',
        lastName: 'B',
        displayName: null,
        contactMethods: [],
      },
    ]
    const { importContacts } = useContactImport()
    const results = await importContacts([
      {
        firstName: 'anna',
        lastName: 'b',
        phones: [{ value: '+41791234567', isPrimary: true }],
      },
    ])

    expect(results[0]!.status).toBe('skipped')
  })

  it('imports cleanly when only valid phones present', async () => {
    const { importContacts } = useContactImport()
    const results = await importContacts([
      {
        firstName: 'Clean',
        lastName: null,
        phones: [{ value: '+41791234567', isPrimary: true }],
        rawPhoneNumbers: [],
      },
    ])

    expect(results[0]!.status).toBe('imported')
    expect(results[0]!.rawPhoneNumbers).toEqual([])
  })
})
