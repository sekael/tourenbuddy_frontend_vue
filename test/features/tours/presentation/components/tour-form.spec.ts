import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TourForm from '@/features/tours/presentation/components/tour-form.vue'

function mountForm(props: Record<string, unknown> = {}) {
  return mount(TourForm, {
    props: { submitLabel: 'Save', ...props },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { contacts: { contacts: [] } },
        }),
      ],
      stubs: { ContactChip: true },
    },
  })
}

describe('tourForm', () => {
  describe('disabled prop', () => {
    it('disables the fieldset so inputs and non-picker buttons are inert', async () => {
      const wrapper = mountForm({ disabled: true })
      const fieldset = wrapper.find('fieldset.form-fieldset')
      expect(fieldset.exists()).toBe(true)
      expect(fieldset.attributes('disabled')).toBeDefined()

      // Native <fieldset disabled> disables nested form controls
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.disabled).toBe(true)

      const submit = wrapper.find('.submit-btn').element as HTMLButtonElement
      expect(submit.disabled).toBe(true)

      const cancel = wrapper.find('.cancel-btn').element as HTMLButtonElement
      expect(cancel.disabled).toBe(true)
    })

    it('does not emit submit while disabled', async () => {
      const wrapper = mountForm({ disabled: true })
      // Direct handleSubmit via form event (bypassing disabled button click)
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('emits submit when not disabled and name is valid', async () => {
      const wrapper = mountForm({ disabled: false })
      const nameInput = wrapper.find('#tf-tourName')
      await nameInput.setValue('My Tour')
      await wrapper.find('form').trigger('submit.prevent')
      expect(wrapper.emitted('submit')).toHaveLength(1)
    })

    it('does not attribute disabled on fieldset when disabled is false', () => {
      const wrapper = mountForm({ disabled: false })
      const fieldset = wrapper.find('fieldset.form-fieldset')
      expect(fieldset.attributes('disabled')).toBeUndefined()
    })
  })

  describe('initialName prop reactivity', () => {
    it('updates name field when initialName prop changes to a non-null value', async () => {
      const wrapper = mountForm({ initialName: 'Original' })
      await wrapper.setProps({ initialName: 'Updated Name' })
      await nextTick()
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.value).toBe('Updated Name')
    })

    it('does not overwrite name when initialName prop changes to null', async () => {
      const wrapper = mountForm({ initialName: 'Keep Me' })
      await wrapper.setProps({ initialName: null })
      await nextTick()
      const nameInput = wrapper.find('#tf-tourName').element as HTMLInputElement
      expect(nameInput.value).toBe('Keep Me')
    })
  })
})
