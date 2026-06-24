import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseIcon from '@/core/components/base-icon.vue'

describe('baseIcon', () => {
  it('should fall back to the md size class when size is omitted', () => {
    const wrapper = mount(BaseIcon, { props: { name: 'close' } })
    expect(wrapper.classes()).toContain('base-icon--md')
  })

  it('should not emit an inline variation-settings style when weight is omitted', () => {
    const wrapper = mount(BaseIcon, { props: { name: 'close' } })
    expect(wrapper.attributes('style')).toBeUndefined()
  })

  it('should override the weight axis only when a weight is provided', () => {
    const wrapper = mount(BaseIcon, { props: { name: 'close', weight: 600 } })
    expect(wrapper.attributes('style')).toContain('\'wght\' 600')
  })

  it('should keep the glyph decorative via aria-hidden', () => {
    const wrapper = mount(BaseIcon, { props: { name: 'map' } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
