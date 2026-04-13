import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactDetailView from '@/features/contacts/presentation/components/contact-detail-view.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'

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

function mountDetail(contact = mockContact) {
  return mount(ContactDetailView, {
    props: { contact },
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

    it('should call updateContact store action when save name is clicked', async () => {
      const wrapper = mountDetail()
      const store = useContactsStore()

      const input = wrapper.find('#dv-firstName')
      await input.setValue('Annika')
      await wrapper.find('.save-btn').trigger('click')

      expect(store.updateContact).toHaveBeenCalledWith('c-1', {
        firstName: 'Annika',
        lastName: 'Meier',
        displayName: null,
      })
    })

    it('should show validation error when first name is cleared', async () => {
      const wrapper = mountDetail()
      await wrapper.find('#dv-firstName').setValue('')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.find('.error-text').text()).toBe('First name is required')
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
      expect(wrapper.find('.error-text').text()).toBe('Value is required')
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
})
