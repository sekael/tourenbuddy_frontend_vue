import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactCreationDialog from '@/features/contacts/presentation/components/contact-creation-dialog.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: { id: 'user-1' }, isAuthenticated: true }),
}))

vi.mock('@/features/contacts/data/repositories/contacts-repository-impl', () => ({
  ContactsRepositoryImpl: vi.fn().mockImplementation(() => ({
    fetchContacts: vi.fn().mockResolvedValue([]),
    createContact: vi.fn().mockResolvedValue({
      id: 'new-c',
      userId: 'user-1',
      firstName: 'Test',
      lastName: null,
      displayName: null,
      contactMethods: [],
    }),
  })),
}))

vi.mock('@/features/contacts/data/repositories/contact-methods-repository-impl', () => ({
  ContactMethodsRepositoryImpl: vi.fn().mockImplementation(() => ({
    addMethod: vi.fn().mockResolvedValue({
      id: 'm1',
      contactId: 'new-c',
      methodType: 'email',
      value: 'test@example.com',
      label: null,
      isPrimary: true,
      isValid: true,
    }),
  })),
}))

vi.mock('@/features/contacts/presentation/composables/use-contact-picker', () => ({
  isContactPickerSupported: false,
  useContactPicker: () => ({
    isSupported: false,
    pickContacts: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('@/features/contacts/presentation/composables/use-vcard-import', () => ({
  useVCardImport: () => ({
    parseVCardFile: vi.fn(),
    parseVCardFiles: vi.fn(),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params)
        return `${key}:${JSON.stringify(params)}`
      return key
    },
    locale: { value: 'en' },
  }),
}))

function mountDialog() {
  return mount(ContactCreationDialog, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs: {
        BottomSheet: { template: '<div><slot /></div>' },
        ContactForm: { template: '<div />' },
        ErrorSnackbar: { template: '<div />' },
      },
    },
  })
}

describe('contact-creation-dialog import branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('noValidPhone branch: phones=0 raw>0 → contact skipped in results', async () => {
    const wrapper = mountDialog()
    const store = useContactsStore()
    const addContactSpy = vi.spyOn(store, 'addContact')

    // Directly trigger processImportedContacts via the exposed internal (call pickContacts path)
    // Instead, mount and access the component's internal via the vm
    const vm = wrapper.vm as any
    await vm.processImportedContacts([
      {
        firstName: 'NoPhone',
        lastName: null,
        phones: [],
        rawPhoneNumbers: ['ext. 1234'],
        emails: [],
      },
    ])

    expect(addContactSpy).not.toHaveBeenCalled()
    expect(vm.importResults).toHaveLength(1)
    expect(vm.importResults[0].status).toBe('skipped')
  })

  it('someInvalidPhonesDiscarded branch: phones>0 raw>0 → contact imported', async () => {
    const wrapper = mountDialog()
    const store = useContactsStore()
    const addContactSpy = vi.spyOn(store, 'addContact').mockResolvedValue(undefined)

    const vm = wrapper.vm as any
    await vm.processImportedContacts([
      {
        firstName: 'PartialPhone',
        lastName: null,
        phones: [{ value: '+41791234567', label: null, isPrimary: true }],
        rawPhoneNumbers: ['ext. 5678'],
        emails: [],
      },
    ])

    expect(addContactSpy).toHaveBeenCalledWith(
      'PartialPhone',
      null,
      null,
      [{ value: '+41791234567', label: null, isPrimary: true }],
      'import',
      [],
    )
    expect(vm.importResults[0].status).toBe('imported')
  })

  it('email-only fallback: phones=0 raw=0 emails>0 → addContact called with emails', async () => {
    const wrapper = mountDialog()
    const store = useContactsStore()
    const addContactSpy = vi.spyOn(store, 'addContact').mockResolvedValue(undefined)

    const vm = wrapper.vm as any
    await vm.processImportedContacts([
      {
        firstName: 'EmailOnly',
        lastName: null,
        phones: [],
        rawPhoneNumbers: [],
        emails: ['test@example.com'],
      },
    ])

    expect(addContactSpy).toHaveBeenCalledWith('EmailOnly', null, null, [], 'import', ['test@example.com'])
    expect(vm.importResults[0].status).toBe('imported')
  })
})
