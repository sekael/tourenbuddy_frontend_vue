import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactDetailView from '@/features/contacts/presentation/components/contact-detail-view.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))
vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({ currentUser: null, isAuthenticated: false }),
}))
vi.mock('@/features/friendships/data/repositories/friendship-repository-impl', () => ({
  FriendshipRepositoryImpl: vi.fn().mockImplementation(() => ({
    sendRequest: vi.fn(),
    accept: vi.fn(),
    deny: vi.fn(),
    cancel: vi.fn(),
    listIncoming: vi.fn().mockResolvedValue([]),
    listFriendships: vi.fn().mockResolvedValue([]),
    findUserByPhone: vi.fn(),
    findUsersByPhones: vi.fn(),
    findPhonesByUserIds: vi.fn().mockResolvedValue([]),
    removeFriendship: vi.fn(),
  })),
}))

const mockContact = {
  id: 'c-1',
  userId: 'u-1',
  firstName: 'Anna',
  lastName: 'Meier',
  displayName: null,
  contactMethods: [
    {
      id: 'm-1',
      contactId: 'c-1',
      methodType: 'phone' as const,
      value: '+41 79 111 22 33',
      label: 'Mobile',
      isPrimary: true,
    },
  ],
}

function mountDetail(contact = mockContact, linkedFriendUserId: string | null = null) {
  return mount(ContactDetailView, {
    props: { contact, linkedFriendUserId },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })],
    },
  })
}

describe('contactDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('name editing', () => {
    it('should pre-fill name fields from contact prop', () => {
      const wrapper = mountDetail()
      expect((wrapper.find('#dv-firstName').element as HTMLInputElement).value).toBe('Anna')
      expect((wrapper.find('#dv-lastName').element as HTMLInputElement).value).toBe('Meier')
    })

    it('should call updateContact store action and emit back when save name is clicked', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.updateContact).mockResolvedValue(undefined as never)

      const input = wrapper.find('#dv-firstName')
      await input.setValue('Annika')
      await wrapper.find('.save-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.updateContact).toHaveBeenCalledWith('c-1', {
        firstName: 'Annika',
        lastName: 'Meier',
        displayName: null,
      })
      expect(wrapper.emitted('back')).toHaveLength(1)
    })

    it('should show validation error when first name is cleared', async () => {
      const wrapper = mountDetail()
      await wrapper.find('#dv-firstName').setValue('')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.find('.error-text').text()).toBe('contacts.detailView.firstNameRequired')
    })
  })

  describe('contact methods', () => {
    it('should display existing contact methods', () => {
      const wrapper = mountDetail()
      expect(wrapper.find('.method-row').exists()).toBe(true)
      const valueInput = wrapper.find('.method-fields .input-sm')
      expect((valueInput.element as HTMLInputElement).value).toBe('+41 79 111 22 33')
    })

    it('should show empty methods message when no methods', () => {
      const wrapper = mountDetail({ ...mockContact, contactMethods: [] })
      expect(wrapper.find('.empty-methods').exists()).toBe(true)
    })

    it('should call removeMethodFromContact when delete icon clicked', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()

      await wrapper.find('.icon-btn--danger').trigger('click')
      expect(store.removeMethodFromContact).toHaveBeenCalledWith('c-1', 'm-1')
    })

    it('should show primary star button for phone methods', () => {
      const wrapper = mountDetail()
      expect(wrapper.find('.primary-star').exists()).toBe(true)
    })

    it('should call setPrimaryPhoneOnContact when non-primary star is clicked', async () => {
      const contactWithTwoPhones = {
        ...mockContact,
        contactMethods: [
          {
            id: 'm-1',
            contactId: 'c-1',
            methodType: 'phone' as const,
            value: '+41 79 111 22 33',
            label: null,
            isPrimary: true,
          },
          {
            id: 'm-2',
            contactId: 'c-1',
            methodType: 'phone' as const,
            value: '+41 44 222 33 44',
            label: null,
            isPrimary: false,
          },
        ],
      }
      const wrapper = mountDetail(contactWithTwoPhones)
      const store = useContactsStore()
      vi.mocked(store.setPrimaryPhoneOnContact).mockResolvedValue(undefined as never)

      const stars = wrapper.findAll('.primary-star')
      await stars[1]!.trigger('click')

      expect(store.setPrimaryPhoneOnContact).toHaveBeenCalledWith('c-1', 'm-2')
    })

    it('should show error when setPrimaryPhoneOnContact fails', async () => {
      const contactWithTwoPhones = {
        ...mockContact,
        contactMethods: [
          {
            id: 'm-1',
            contactId: 'c-1',
            methodType: 'phone' as const,
            value: '+41 79 111 22 33',
            label: null,
            isPrimary: true,
          },
          {
            id: 'm-2',
            contactId: 'c-1',
            methodType: 'phone' as const,
            value: '+41 44 222 33 44',
            label: null,
            isPrimary: false,
          },
        ],
      }
      const wrapper = mountDetail(contactWithTwoPhones)
      const store = useContactsStore()
      vi.mocked(store.setPrimaryPhoneOnContact).mockRejectedValue(new Error('RPC failed'))

      const stars = wrapper.findAll('.primary-star')
      await stars[1]!.trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-text').exists()).toBe(true)
    })
  })

  describe('add method', () => {
    it('should show add method form when add button clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.add-method-btn').trigger('click')
      expect(wrapper.find('.add-method-form').exists()).toBe(true)
    })

    it('should show validation error if value is empty on add', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.add-method-btn').trigger('click')
      await wrapper.find('.add-method-form .save-btn').trigger('click')
      expect(wrapper.find('.error-text').text()).toBe('contacts.detailView.valueRequired')
    })

    it('should hide add method form when cancel clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.add-method-btn').trigger('click')
      expect(wrapper.find('.add-method-form').exists()).toBe(true)

      await wrapper.find('.add-method-form .cancel-btn').trigger('click')
      expect(wrapper.find('.add-method-form').exists()).toBe(false)
    })
  })

  describe('delete contact', () => {
    it('should show confirmation when delete button clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.delete-btn').trigger('click')
      expect(wrapper.find('.delete-confirm-text').exists()).toBe(true)
      expect(wrapper.find('.delete-confirm-btn').exists()).toBe(true)
    })

    it('should hide confirmation when cancel clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.delete-btn').trigger('click')
      await wrapper.find('.cancel-btn').trigger('click')

      expect(wrapper.find('.delete-confirm-text').exists()).toBe(false)
      expect(wrapper.find('.delete-btn').exists()).toBe(true)
    })

    it('should call deleteContact store action and emit deleted when confirmed', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.deleteContact).mockResolvedValue(undefined)

      await wrapper.find('.delete-btn').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.deleteContact).toHaveBeenCalledWith('c-1')
      expect(wrapper.emitted('deleted')).toHaveLength(1)
    })
  })

  describe('back navigation', () => {
    it('should emit back when back button clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('.back-btn').trigger('click')
      expect(wrapper.emitted('back')).toHaveLength(1)
    })
  })

  describe('linked-friendship deletion (edges)', () => {
    it('does not render friend warning when contact is not linked to a friend', async () => {
      const wrapper = mountDetail(mockContact, null)
      await wrapper.find('.delete-btn').trigger('click')
      expect(wrapper.find('.delete-friend-warning').exists()).toBe(false)
    })

    it('renders friend warning only when linked', async () => {
      const wrapper = mountDetail(mockContact, 'user-friend')
      await wrapper.find('.delete-btn').trigger('click')
      expect(wrapper.find('.delete-friend-warning').exists()).toBe(true)
    })

    it('skips removeFriendship when no linked friend on confirm', async () => {
      const wrapper = mountDetail(mockContact, null)
      const friendships = useFriendshipsStore()
      const contacts = useContactsStore()
      vi.mocked(contacts.deleteContact).mockResolvedValue(undefined)

      await wrapper.find('.delete-btn').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await flushPromises()

      expect(friendships.removeFriendship).not.toHaveBeenCalled()
      expect(contacts.deleteContact).toHaveBeenCalledWith('c-1')
    })

    it('does NOT delete contact when removeFriendship fails (atomic-ish)', async () => {
      const wrapper = mountDetail(mockContact, 'user-friend')
      const friendships = useFriendshipsStore()
      const contacts = useContactsStore()
      vi.mocked(friendships.removeFriendship).mockRejectedValue(new Error('rpc failed'))

      await wrapper.find('.delete-btn').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await flushPromises()

      expect(friendships.removeFriendship).toHaveBeenCalledWith('user-friend')
      expect(contacts.deleteContact).not.toHaveBeenCalled()
      expect(wrapper.emitted('deleted')).toBeFalsy()
      expect(wrapper.find('.error-text').exists()).toBe(true)
    })

    it('removes friendship before deleting contact when both succeed', async () => {
      // Edge: ordering matters because deleteContact may cascade delete the friendship row
      // out from under removeFriendship and surface a confusing error.
      const wrapper = mountDetail(mockContact, 'user-friend')
      const friendships = useFriendshipsStore()
      const contacts = useContactsStore()
      const order: string[] = []
      vi.mocked(friendships.removeFriendship).mockImplementation(async () => {
        order.push('rm')
      })
      vi.mocked(contacts.deleteContact).mockImplementation(async () => {
        order.push('del')
      })

      await wrapper.find('.delete-btn').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await flushPromises()

      expect(order).toEqual(['rm', 'del'])
    })
  })
})
