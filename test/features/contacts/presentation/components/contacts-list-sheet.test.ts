import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactsListSheet from '@/features/contacts/presentation/components/contacts-list-sheet.vue'

vi.mock('@/features/contacts/presentation/composables/use-contact-picker', () => ({
  useContactPicker: () => ({ isSupported: false, pickContacts: vi.fn() }),
}))

vi.mock('@/features/contacts/presentation/composables/use-vcard-import', () => ({
  useVCardImport: () => ({ parseVCardFile: vi.fn() }),
}))

const mockContacts = [
  {
    id: '1',
    userId: 'u-1',
    firstName: 'Anna',
    lastName: 'Meier',
    displayName: null,
    contactMethods: [
      {
        id: 'm-1',
        contactId: '1',
        methodType: 'phone',
        value: '+41 79 111 22 33',
        label: null,
        isPrimary: true,
      },
    ],
  },
  {
    id: '2',
    userId: 'u-1',
    firstName: 'Bob',
    lastName: null,
    displayName: null,
    contactMethods: [],
  },
]

const ContactDetailViewStub = {
  name: 'ContactDetailView',
  template: '<div data-testid="contact-detail" />',
  emits: ['back', 'deleted'],
  props: ['contact'],
}

function mountSheet() {
  return mount(ContactsListSheet, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            contacts: { contacts: mockContacts, isLoading: false, error: null },
          },
        }),
      ],
      stubs: {
        ContactDetailView: ContactDetailViewStub,
        ContactForm: {
          template: '<div data-testid="contact-form" />',
          emits: ['submit', 'cancel'],
        },
      },
    },
  })
}

describe('contactsListSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list view', () => {
    it('should render contacts list with all contacts', () => {
      const wrapper = mountSheet()
      const rows = wrapper.findAll('.contact-row')
      expect(rows).toHaveLength(2)
    })

    it('should display contact name in each row', () => {
      const wrapper = mountSheet()
      const rows = wrapper.findAll('.contact-row')
      expect(rows[0]!.text()).toContain('Anna Meier')
      expect(rows[1]!.text()).toContain('Bob')
    })

    it('should not display phone number in list rows', () => {
      const wrapper = mountSheet()
      expect(wrapper.find('.contact-phone').exists()).toBe(false)
    })

    it('should display phone as subtitle when displayName is set', () => {
      const contactsWithDisplayName = [
        {
          id: '1',
          userId: 'u-1',
          firstName: 'Anna',
          lastName: 'Meier',
          displayName: 'Annie',
          contactMethods: [
            {
              id: 'm-1',
              contactId: '1',
              methodType: 'phone',
              value: '+41 79 111 22 33',
              label: null,
              isPrimary: true,
            },
          ],
        },
      ]
      const wrapper = mount(ContactsListSheet, {
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              stubActions: false,
              initialState: {
                contacts: { contacts: contactsWithDisplayName, isLoading: false, error: null },
              },
            }),
          ],
          stubs: {
            ContactDetailView: { template: '<div />' },
            ContactForm: { template: '<div />' },
          },
        },
      })
      const row = wrapper.find('.contact-row')
      expect(row.find('.contact-name').text()).toBe('Annie')
      expect(row.find('.contact-subtitle').text()).toBe('+41 79 111 22 33')
    })

    it('should display phone as subtitle when only firstName is set', () => {
      const wrapper = mountSheet()
      const rows = wrapper.findAll('.contact-row')
      // Anna Meier (firstName + lastName, phone present)
      expect(rows[0]!.find('.contact-subtitle').text()).toBe('+41 79 111 22 33')
    })

    it('should hide subtitle when contact has no phone', () => {
      const wrapper = mountSheet()
      const rows = wrapper.findAll('.contact-row')
      // Bob (no lastName, no phone)
      expect(rows[1]!.find('.contact-subtitle').exists()).toBe(false)
    })

    it('should show empty state when no contacts', () => {
      const wrapper = mount(ContactsListSheet, {
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              stubActions: false,
              initialState: {
                contacts: { contacts: [], isLoading: false, error: null },
              },
            }),
          ],
          stubs: {
            ContactDetailView: { template: '<div />' },
            ContactForm: { template: '<div />' },
          },
        },
      })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })
  })

  describe('navigation', () => {
    it('should navigate to detail view when a contact row is clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.contact-row')[0]!.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(true)
    })

    it('should navigate to add view when add button is clicked', async () => {
      const wrapper = mountSheet()
      await wrapper.find('.add-contact-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="contact-form"]').exists()).toBe(true)
    })

    it('should return to list from detail when detail emits back', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.contact-row')[0]!.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(true)

      await wrapper.findComponent(ContactDetailViewStub).vm.$emit('back')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.contact-row').exists()).toBe(true)
      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(false)
    })

    it('should return to list and clear selection when detail emits deleted', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.contact-row')[0]!.trigger('click')
      await wrapper.vm.$nextTick()

      await wrapper.findComponent(ContactDetailViewStub).vm.$emit('deleted')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.contact-row').exists()).toBe(true)
      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(false)
    })

    it('should return to list when selected contact is removed from the store', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.contact-row')[0]!.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(true)

      // Simulate store removing the contact (e.g. after delete completes)
      const { useContactsStore: getStore }
        = await import('@/features/contacts/presentation/stores/contacts-store')
      const store = getStore()
      store.contacts = store.contacts.filter((c: { id: string }) => c.id !== '1')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="contact-detail"]').exists()).toBe(false)
      expect(wrapper.find('.contact-row').exists()).toBe(true)
    })
  })

  describe('close', () => {
    it('should emit close when bottom sheet close button clicked in list view', async () => {
      const wrapper = mountSheet()
      await wrapper.find('[aria-label="core.drawer.close"], [aria-label="Close"]').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should navigate back to list (not close) when in detail view and close is pressed', async () => {
      const wrapper = mountSheet()
      await wrapper.findAll('.contact-row')[0]!.trigger('click')
      await wrapper.vm.$nextTick()

      await wrapper.find('[aria-label="core.drawer.close"], [aria-label="Close"]').trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('close')).toBeFalsy()
      expect(wrapper.find('.contact-row').exists()).toBe(true)
    })
  })
})
