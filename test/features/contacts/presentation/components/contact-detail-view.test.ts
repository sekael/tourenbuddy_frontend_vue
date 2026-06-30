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
      isValid: true,
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

async function enterEditMode(wrapper: ReturnType<typeof mountDetail>) {
  await wrapper.find('[data-testid="edit-contact-btn"]').trigger('click')
}

describe('contactDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('view/edit mode toggle', () => {
    it('should default to view mode showing read-only name spans', () => {
      const wrapper = mountDetail()
      expect(wrapper.find('[data-testid="edit-contact-btn"]').exists()).toBe(true)
      expect(wrapper.find('#dv-firstName').exists()).toBe(false)
      expect(wrapper.find('.view-value').text()).toContain('Anna')
    })

    it('should enter edit mode exposing inputs when Edit is clicked', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      expect(wrapper.find('#dv-firstName').exists()).toBe(true)
      expect((wrapper.find('#dv-firstName').element as HTMLInputElement).value).toBe('Anna')
      expect(wrapper.find('#dv-lastName').exists()).toBe(true)
    })

    it('should revert dirty name input to original value when Cancel is clicked', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      await wrapper.find('#dv-firstName').setValue('Annika')
      await wrapper.find('.form-actions .base-button--secondary').trigger('click')

      expect(wrapper.find('[data-testid="edit-contact-btn"]').exists()).toBe(true)
      expect(wrapper.find('#dv-firstName').exists()).toBe(false)
      // view-value shows original name again
      expect(wrapper.text()).toContain('Anna')
    })

    it('should show add-method button and delete buttons only in edit mode', async () => {
      const wrapper = mountDetail()
      expect(wrapper.find('.add-method-btn').exists()).toBe(false)
      expect(wrapper.find('[data-testid="remove-method-btn"]').exists()).toBe(false)

      await enterEditMode(wrapper)
      expect(wrapper.find('.add-method-btn').exists()).toBe(true)
      expect(wrapper.find('[data-testid="remove-method-btn"]').exists()).toBe(true)
    })

    it('should make primary-phone star non-interactive in view mode', () => {
      const wrapper = mountDetail()
      // In view mode it renders as a span (not a button)
      const star = wrapper.find('.primary-star')
      expect(star.element.tagName.toLowerCase()).toBe('span')
    })

    it('should make primary-phone star interactive in edit mode', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      const star = wrapper.find('.primary-star')
      expect(star.element.tagName.toLowerCase()).toBe('button')
    })
  })

  describe('save all (edit mode)', () => {
    it('should call updateContact and transition to view mode on success', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.updateContact).mockResolvedValue(undefined as never)

      await enterEditMode(wrapper)
      await wrapper.find('#dv-firstName').setValue('Annika')
      await wrapper.find('.form-actions .base-button--primary').trigger('click')
      await flushPromises()

      expect(store.updateContact).toHaveBeenCalledWith('c-1', {
        firstName: 'Annika',
        lastName: 'Meier',
        displayName: null,
      })
      // After success, back to view mode
      expect(wrapper.find('[data-testid="edit-contact-btn"]').exists()).toBe(true)
      expect(wrapper.find('#dv-firstName').exists()).toBe(false)
    })

    it('should stay in edit mode and show error when updateContact fails', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.updateContact).mockRejectedValue(new Error('DB error'))

      await enterEditMode(wrapper)
      await wrapper.find('.form-actions .base-button--primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('#dv-firstName').exists()).toBe(true)
      expect(wrapper.find('.error-text').exists()).toBe(true)
    })

    it('should show validation error and stay in edit mode when first name is empty', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      await wrapper.find('#dv-firstName').setValue('')
      await wrapper.find('.form-actions .base-button--primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('#dv-firstName').exists()).toBe(true)
      expect(wrapper.find('.error-text').exists()).toBe(true)
    })
  })

  describe('commitPendingEdits', () => {
    it('should resolve immediately when in view mode', async () => {
      const wrapper = mountDetail()
      const vm = wrapper.vm as InstanceType<typeof ContactDetailView>

      await expect(vm.commitPendingEdits()).resolves.toBeUndefined()
    })

    it('should reject and stay in edit mode when a save fails', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.updateContact).mockRejectedValue(new Error('save failed'))

      await enterEditMode(wrapper)
      const vm = wrapper.vm as InstanceType<typeof ContactDetailView>

      await expect(vm.commitPendingEdits()).rejects.toThrow()
      await flushPromises()

      expect(wrapper.find('#dv-firstName').exists()).toBe(true)
    })

    it('should resolve and return to view mode when all saves succeed', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.updateContact).mockResolvedValue(undefined as never)

      await enterEditMode(wrapper)
      const vm = wrapper.vm as InstanceType<typeof ContactDetailView>

      await expect(vm.commitPendingEdits()).resolves.toBeUndefined()
      await flushPromises()

      expect(wrapper.find('[data-testid="edit-contact-btn"]').exists()).toBe(true)
    })
  })

  describe('contact methods', () => {
    it('should display existing contact methods in view mode', () => {
      const wrapper = mountDetail()
      expect(wrapper.find('.method-row').exists()).toBe(true)
      expect(wrapper.find('.view-value').text()).toContain('Anna')
    })

    it('should show empty methods message when no methods', () => {
      const wrapper = mountDetail({ ...mockContact, contactMethods: [] })
      expect(wrapper.find('.empty-methods').exists()).toBe(true)
    })

    it('should call removeMethodFromContact when delete icon clicked in edit mode', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()

      await enterEditMode(wrapper)
      await wrapper.find('[data-testid="remove-method-btn"]').trigger('click')
      expect(store.removeMethodFromContact).toHaveBeenCalledWith('c-1', 'm-1')
    })

    it('should call setPrimaryPhoneOnContact in edit mode when non-primary star clicked', async () => {
      const contactWithTwoPhones = {
        ...mockContact,
        contactMethods: [
          { id: 'm-1', contactId: 'c-1', methodType: 'phone' as const, value: '+41 79 111 22 33', label: null, isPrimary: true, isValid: true },
          { id: 'm-2', contactId: 'c-1', methodType: 'phone' as const, value: '+41 44 222 33 44', label: null, isPrimary: false, isValid: true },
        ],
      }
      const wrapper = mountDetail(contactWithTwoPhones)
      const store = useContactsStore()
      vi.mocked(store.setPrimaryPhoneOnContact).mockResolvedValue(undefined as never)

      await enterEditMode(wrapper)
      const stars = wrapper.findAll('button.primary-star')
      await stars[1]!.trigger('click')

      expect(store.setPrimaryPhoneOnContact).toHaveBeenCalledWith('c-1', 'm-2')
    })

    it('should show error when setPrimaryPhoneOnContact fails in edit mode', async () => {
      const contactWithTwoPhones = {
        ...mockContact,
        contactMethods: [
          { id: 'm-1', contactId: 'c-1', methodType: 'phone' as const, value: '+41 79 111 22 33', label: null, isPrimary: true, isValid: true },
          { id: 'm-2', contactId: 'c-1', methodType: 'phone' as const, value: '+41 44 222 33 44', label: null, isPrimary: false, isValid: true },
        ],
      }
      const wrapper = mountDetail(contactWithTwoPhones)
      const store = useContactsStore()
      vi.mocked(store.setPrimaryPhoneOnContact).mockRejectedValue(new Error('RPC failed'))

      await enterEditMode(wrapper)
      const stars = wrapper.findAll('button.primary-star')
      await stars[1]!.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-text').exists()).toBe(true)
    })
  })

  describe('add method', () => {
    it('should show add method form in edit mode after add button clicked', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      await wrapper.find('.add-method-btn').trigger('click')
      expect(wrapper.find('.add-method-form').exists()).toBe(true)
    })

    it('should show validation error if value is empty on add', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      await wrapper.find('.add-method-btn').trigger('click')
      await wrapper.find('.add-method-form .base-button--primary').trigger('click')
      expect(wrapper.find('.error-text').text()).toBe('contacts.detailView.valueRequired')
    })

    it('should discard add-method draft when Cancel is clicked from edit mode', async () => {
      const wrapper = mountDetail()
      await enterEditMode(wrapper)
      await wrapper.find('.add-method-btn').trigger('click')
      expect(wrapper.find('.add-method-form').exists()).toBe(true)

      await wrapper.find('.form-actions .base-button--secondary').trigger('click')
      // Returned to view mode — add-method-form gone
      expect(wrapper.find('.add-method-form').exists()).toBe(false)
      expect(wrapper.find('[data-testid="edit-contact-btn"]').exists()).toBe(true)
    })
  })

  describe('delete contact', () => {
    it('should show confirmation when delete button clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      expect(wrapper.find('.delete-confirm-text').exists()).toBe(true)
      expect(wrapper.find('.base-button--danger').exists()).toBe(true)
    })

    it('should hide confirmation when cancel clicked in delete section', async () => {
      const wrapper = mountDetail()
      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      const deleteSection = wrapper.find('.section--danger')
      await deleteSection.find('.base-button--secondary').trigger('click')

      expect(wrapper.find('.delete-confirm-text').exists()).toBe(false)
      expect(wrapper.find('[data-testid="delete-btn"]').exists()).toBe(true)
    })

    it('should call deleteContact and emit deleted when confirmed', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()
      vi.mocked(store.deleteContact).mockResolvedValue(undefined)

      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      await wrapper.find('.base-button--danger').trigger('click')
      await flushPromises()

      expect(store.deleteContact).toHaveBeenCalledWith('c-1')
      expect(wrapper.emitted('deleted')).toHaveLength(1)
    })

    it('does NOT delete contact when removeFriendship fails', async () => {
      const wrapper = mountDetail(mockContact, 'user-friend')
      const friendships = useFriendshipsStore()
      const contacts = useContactsStore()
      vi.mocked(friendships.removeFriendship).mockRejectedValue(new Error('rpc failed'))

      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      await wrapper.find('.base-button--danger').trigger('click')
      await flushPromises()

      expect(contacts.deleteContact).not.toHaveBeenCalled()
      expect(wrapper.emitted('deleted')).toBeFalsy()
      expect(wrapper.find('.error-text').exists()).toBe(true)
    })
  })

  describe('back navigation', () => {
    it('should emit back when back button clicked', async () => {
      const wrapper = mountDetail()
      await wrapper.find('[data-testid="back-btn"]').trigger('click')
      expect(wrapper.emitted('back')).toHaveLength(1)
    })
  })

  describe('linked-friendship deletion', () => {
    it('does not render friend warning when contact is not linked to a friend', async () => {
      const wrapper = mountDetail(mockContact, null)
      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      expect(wrapper.find('.delete-friend-warning').exists()).toBe(false)
    })

    it('renders friend warning when contact is linked to a friend', async () => {
      const wrapper = mountDetail(mockContact, 'user-friend')
      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      expect(wrapper.find('.delete-friend-warning').exists()).toBe(true)
    })

    it('skips removeFriendship when no linked friend', async () => {
      const wrapper = mountDetail(mockContact, null)
      const friendships = useFriendshipsStore()
      const contacts = useContactsStore()
      vi.mocked(contacts.deleteContact).mockResolvedValue(undefined)

      await wrapper.find('[data-testid="delete-btn"]').trigger('click')
      await wrapper.find('.base-button--danger').trigger('click')
      await flushPromises()

      expect(friendships.removeFriendship).not.toHaveBeenCalled()
      expect(contacts.deleteContact).toHaveBeenCalledWith('c-1')
    })
  })
})
