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

  describe('end-point row conditional rendering', () => {
    it('shows "Add end point" button and hides point inputs when endPoint is null', () => {
      const wrapper = mountForm()
      // No initialEndPoint → end-point row collapsed to "Add" button
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('Add end point'))
      expect(addBtn.length).toBeGreaterThan(0)
      // No point-coords span for end point (only start point "Not set" shown)
      const coords = wrapper.findAll('.point-coords')
      expect(coords.length).toBe(1) // only start point
    })

    it('reveals end-point row when initialEndPoint is provided', () => {
      const wrapper = mountForm({ initialEndPoint: { lng: 7.9, lat: 46.5 } })
      // "Add end point" button should not be present
      const addBtn = wrapper.findAll('button').filter(b => b.text().includes('Add end point'))
      expect(addBtn.length).toBe(0)
      // Remove button present for end point
      const removeBtns = wrapper.findAll('.remove-point-btn')
      expect(removeBtns.length).toBeGreaterThan(0)
    })
  })

  describe('clearing end point also clears metadata', () => {
    it('should include null endPointName and endPointElevation in draft when end point is removed', async () => {
      const wrapper = mountForm({
        initialEndPoint: { lng: 7.9, lat: 46.5 },
        initialEndPointMeta: { name: 'Murren', elevation: 1638 },
      })
      // Remove the end point
      const removeBtn = wrapper.find('.remove-point-btn')
      await removeBtn.trigger('click')
      await nextTick()

      // Submit with a valid name
      const nameInput = wrapper.find('#tf-tourName')
      await nameInput.setValue('My Tour')
      await wrapper.find('form').trigger('submit.prevent')

      const emitted = wrapper.emitted('submit')
      expect(emitted).toHaveLength(1)
      const draft = (emitted![0] as unknown[])[0] as Record<string, unknown>
      expect(draft.endPoint).toBeNull()
      expect(draft.endPointName).toBeNull()
      expect(draft.endPointElevation).toBeNull()
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
