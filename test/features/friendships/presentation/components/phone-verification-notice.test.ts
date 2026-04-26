import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('phoneVerificationNotice', () => {
  it('should render title and body text', () => {
    const wrapper = mount(PhoneVerificationNotice)
    expect(wrapper.text()).toContain('friendships.verificationNotice.title')
    expect(wrapper.text()).toContain('friendships.verificationNotice.body')
  })

  it('should disable confirm button when checkbox is unchecked', () => {
    const wrapper = mount(PhoneVerificationNotice)
    const btn = wrapper.find('.confirm-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('should enable confirm button after checkbox is checked', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.checkbox').setValue(true)
    const btn = wrapper.find('.confirm-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('should emit acknowledged when confirm button is clicked after checkbox', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.checkbox').setValue(true)
    await wrapper.find('.confirm-btn').trigger('click')
    expect(wrapper.emitted('acknowledged')).toBeTruthy()
  })

  it('should not emit acknowledged when confirm clicked without checkbox', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.confirm-btn').trigger('click')
    expect(wrapper.emitted('acknowledged')).toBeFalsy()
  })

  it('should emit close when close button is clicked', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should emit close when overlay backdrop is clicked', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
