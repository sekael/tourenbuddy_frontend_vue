import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BaseTooltip from '@/core/components/base-tooltip.vue'

function mockMatchMedia(hoverNone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: hoverNone,
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

describe('baseTooltip', () => {
  describe('on hover device (desktop)', () => {
    beforeEach(() => mockMatchMedia(false))

    it('should not show bubble on touchstart', async () => {
      const wrapper = mount(BaseTooltip, { props: { text: 'Hint' }, slots: { default: '<span>icon</span>' } })
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      expect(wrapper.find('.tooltip-bubble').classes()).not.toContain('tooltip-bubble--visible')
    })

    it('should render tooltip bubble with correct text', () => {
      const wrapper = mount(BaseTooltip, { props: { text: 'My tooltip' }, slots: { default: '<span>x</span>' } })
      expect(wrapper.find('.tooltip-bubble').text()).toBe('My tooltip')
    })
  })

  describe('on touch device (mobile)', () => {
    beforeEach(() => mockMatchMedia(true))

    it('should show bubble on touchstart', async () => {
      const wrapper = mount(BaseTooltip, { props: { text: 'Hint' }, slots: { default: '<span>icon</span>' } })
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      expect(wrapper.find('.tooltip-bubble').classes()).toContain('tooltip-bubble--visible')
    })

    it('should hide bubble on escape keydown', async () => {
      const wrapper = mount(BaseTooltip, { props: { text: 'Hint' }, slots: { default: '<span>icon</span>' } })
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      expect(wrapper.find('.tooltip-bubble').classes()).toContain('tooltip-bubble--visible')
      await wrapper.find('.tooltip-wrapper').trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('.tooltip-bubble').classes()).not.toContain('tooltip-bubble--visible')
    })

    it('should auto-dismiss after 3 seconds', async () => {
      vi.useFakeTimers()
      const wrapper = mount(BaseTooltip, { props: { text: 'Hint' }, slots: { default: '<span>icon</span>' } })
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      expect(wrapper.find('.tooltip-bubble').classes()).toContain('tooltip-bubble--visible')
      vi.advanceTimersByTime(3000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.tooltip-bubble').classes()).not.toContain('tooltip-bubble--visible')
      vi.useRealTimers()
    })

    it('should reset dismiss timer on repeated touchstart', async () => {
      vi.useFakeTimers()
      const wrapper = mount(BaseTooltip, { props: { text: 'Hint' }, slots: { default: '<span>icon</span>' } })
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      vi.advanceTimersByTime(2000)
      await wrapper.find('.tooltip-wrapper').trigger('touchstart')
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.tooltip-bubble').classes()).toContain('tooltip-bubble--visible')
      vi.useRealTimers()
    })
  })

  it('should have correct role and aria attributes', () => {
    mockMatchMedia(false)
    const wrapper = mount(BaseTooltip, { props: { text: 'Label' }, slots: { default: '<span>x</span>' } })
    const bubble = wrapper.find('.tooltip-bubble')
    expect(bubble.attributes('role')).toBe('tooltip')
    const wrapperId = wrapper.find('.tooltip-wrapper').attributes('aria-describedby')
    expect(wrapperId).toBe(bubble.attributes('id'))
  })
})
