import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PhoneVerificationNotice from '@/features/friendships/presentation/components/phone-verification-notice.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

describe('phoneVerificationNotice (gating edges)', () => {
  it('confirm button starts disabled (checkbox required)', () => {
    const btn = mount(PhoneVerificationNotice).find('.confirm-btn').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('does not emit acknowledged while checkbox unchecked', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.confirm-btn').trigger('click')
    expect(wrapper.emitted('acknowledged')).toBeFalsy()
  })

  it('emits close on backdrop click (dismiss without ack)', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('acknowledged')).toBeFalsy()
  })

  it('emits close on close-btn click (dismiss without ack)', async () => {
    const wrapper = mount(PhoneVerificationNotice)
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('acknowledged')).toBeFalsy()
  })
})
