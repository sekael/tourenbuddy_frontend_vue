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

  it('should have the close button labeled "Close"', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    expect(wrapper.find('.close-btn').attributes('aria-label')).toBe('Close')
  })
})
