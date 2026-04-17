import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdaptiveOverlay from '@/core/components/adaptive-overlay.vue'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('adaptiveOverlay', () => {
  describe('on desktop (>=600px)', () => {
    beforeEach(() => {
      mockMatchMedia(true)
    })

    it('should render DialogWindow on desktop', () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'Settings' } })
      expect(wrapper.find('.dialog-card').exists()).toBe(true)
      expect(wrapper.find('.bottom-sheet').exists()).toBe(false)
    })

    it('should display the title in the dialog', () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'My Title' } })
      expect(wrapper.find('h2').text()).toBe('My Title')
    })

    it('should render slot content inside the dialog', () => {
      const wrapper = mount(AdaptiveOverlay, {
        props: { title: 'Test' },
        slots: { default: '<p class="slot-content">Content</p>' },
      })
      expect(wrapper.find('.slot-content').exists()).toBe(true)
    })

    it('should emit close from the dialog close button on desktop', async () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'Test' } })
      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should emit close when the dialog backdrop is clicked', async () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'Test' } })
      await wrapper.find('.dialog-backdrop').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('on mobile (<600px)', () => {
    beforeEach(() => {
      mockMatchMedia(false)
    })

    it('should render BottomSheet on mobile', () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'Settings' } })
      expect(wrapper.find('.bottom-sheet').exists()).toBe(true)
      expect(wrapper.find('.dialog-card').exists()).toBe(false)
    })

    it('should display the title in the bottom sheet', () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'My Title' } })
      expect(wrapper.find('h2').text()).toBe('My Title')
    })

    it('should render slot content inside the bottom sheet', () => {
      const wrapper = mount(AdaptiveOverlay, {
        props: { title: 'Test' },
        slots: { default: '<p class="slot-content">Content</p>' },
      })
      expect(wrapper.find('.slot-content').exists()).toBe(true)
    })

    it('should emit close from the bottom sheet close button on mobile', async () => {
      const wrapper = mount(AdaptiveOverlay, { props: { title: 'Test' } })
      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })
})
