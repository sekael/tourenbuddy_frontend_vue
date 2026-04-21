import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BottomSheet from '@/core/components/bottom-sheet.vue'

describe('bottomSheet', () => {
  it('should render the title when provided', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'My Sheet' } })
    expect(wrapper.find('h2').text()).toBe('My Sheet')
  })

  it('should not render an h2 when no title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { ariaLabel: 'Sheet' } })
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('should render the default slot content', () => {
    const wrapper = mount(BottomSheet, {
      props: { title: 'Test' },
      slots: { default: '<p class="slot-content">Hello</p>' },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
    expect(wrapper.find('.slot-content').text()).toBe('Hello')
  })

  it('should emit close when the close button is clicked', async () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should have role="dialog" and aria-modal="true"', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('role')).toBe('dialog')
    expect(sheet.attributes('aria-modal')).toBe('true')
  })

  it('should link aria-labelledby to title when title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Labeled' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('aria-labelledby')).toBe('bottom-sheet-title')
    expect(wrapper.find('#bottom-sheet-title').exists()).toBe(true)
  })

  it('should use aria-label fallback when no title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { ariaLabel: 'Custom label' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('aria-label')).toBe('Custom label')
    expect(sheet.attributes('aria-labelledby')).toBeUndefined()
  })

  it('should have the close button with an aria-label', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    expect(wrapper.find('.close-btn').attributes('aria-label')).toBe('core.drawer.close')
  })

  describe('collapsed mode', () => {
    it('should hide close button, drag handle, and footer when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true },
        slots: { footer: '<div class="slot-footer">f</div>' },
      })
      expect(wrapper.find('.close-btn').exists()).toBe(false)
      expect(wrapper.find('.drag-handle').exists()).toBe(false)
      expect(wrapper.find('.footer').attributes('style')).toContain('display: none')
    })

    it('should keep default slot mounted but hidden when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true },
        slots: { default: '<p class="slot-content">Preserved</p>' },
      })
      expect(wrapper.find('.slot-content').exists()).toBe(true)
      expect(wrapper.find('.content').attributes('style')).toContain('display: none')
    })

    it('should preserve slot state across collapsed toggle', async () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: false },
        slots: { default: '<input class="slot-input" />' },
      })
      const input = wrapper.find('.slot-input').element as HTMLInputElement
      input.value = 'typed'
      await wrapper.setProps({ collapsed: true })
      // Same DOM node preserved → value retained
      const afterCollapse = wrapper.find('.slot-input').element as HTMLInputElement
      expect(afterCollapse).toBe(input)
      expect(afterCollapse.value).toBe('typed')
      await wrapper.setProps({ collapsed: false })
      expect((wrapper.find('.slot-input').element as HTMLInputElement).value).toBe('typed')
    })

    it('should hide back button when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true, showBack: true },
      })
      expect(wrapper.find('.back-btn').exists()).toBe(false)
    })
  })
})
