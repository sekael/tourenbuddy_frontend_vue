import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DialogWindow from '@/core/components/dialog-window.vue'

describe('dialogWindow', () => {
  it('should render title when provided', () => {
    const wrapper = mount(DialogWindow, { props: { title: 'My Dialog' } })
    expect(wrapper.find('h2').text()).toBe('My Dialog')
  })

  it('should not render h2 when no title is provided', () => {
    const wrapper = mount(DialogWindow, { props: { ariaLabel: 'Dialog' } })
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('should render slot content', () => {
    const wrapper = mount(DialogWindow, {
      props: { title: 'Test' },
      slots: { default: '<p class="slot-content">Hello</p>' },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
    expect(wrapper.find('.slot-content').text()).toBe('Hello')
  })

  it('should emit close when close button is clicked', async () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Test' } })
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should emit close when backdrop is clicked', async () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Test' } })
    await wrapper.find('.dialog-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should not emit close when the card itself is clicked', async () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Test' } })
    await wrapper.find('.dialog-card').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('should have role="dialog" and aria-modal="true" on the card', () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Test' } })
    const card = wrapper.find('.dialog-card')
    expect(card.attributes('role')).toBe('dialog')
    expect(card.attributes('aria-modal')).toBe('true')
  })

  it('should set aria-labelledby when title is provided', () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Labeled' } })
    const card = wrapper.find('.dialog-card')
    expect(card.attributes('aria-labelledby')).toBe('dialog-window-title')
    expect(wrapper.find('#dialog-window-title').exists()).toBe(true)
  })

  it('should use aria-label fallback when no title is provided', () => {
    const wrapper = mount(DialogWindow, { props: { ariaLabel: 'Custom label' } })
    const card = wrapper.find('.dialog-card')
    expect(card.attributes('aria-label')).toBe('Custom label')
    expect(card.attributes('aria-labelledby')).toBeUndefined()
  })

  it('should label the close button with "Close"', () => {
    const wrapper = mount(DialogWindow, { props: { title: 'Test' } })
    expect(wrapper.find('.close-btn').attributes('aria-label')).toBe('Close')
  })
})
