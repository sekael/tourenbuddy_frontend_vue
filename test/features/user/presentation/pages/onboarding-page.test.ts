import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingPage from '@/features/user/presentation/pages/onboarding-page.vue'

const { mockUpdateProfile, mockSendPhoneVerification } = vi.hoisted(() => ({
  mockUpdateProfile: vi.fn(),
  mockSendPhoneVerification: vi.fn(),
}))

vi.mock('@/features/user/presentation/stores/user-profile-store', () => ({
  useUserProfileStore: vi.fn().mockReturnValue({
    updateProfile: mockUpdateProfile,
    sendPhoneVerification: mockSendPhoneVerification,
    fullProfile: null,
  }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/user/presentation/components/phone-verification-dialog.vue', () => ({
  default: { template: '<div class="phone-verification-stub" />' },
}))

describe('onboardingPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.removeItem('skippedOnboarding')
  })

  it('should render form fields for firstName, lastName, phoneNumber', () => {
    const wrapper = mount(OnboardingPage)
    expect(wrapper.find('#firstName').exists()).toBe(true)
    expect(wrapper.find('#lastName').exists()).toBe(true)
    expect(wrapper.find('#phoneNumber').exists()).toBe(true)
  })

  it('should show validation errors when submitting with empty required fields', async () => {
    const wrapper = mount(OnboardingPage)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('First name is required')
    expect(wrapper.text()).toContain('Last name is required')
  })

  it('should show validation error for invalid phone format', async () => {
    const wrapper = mount(OnboardingPage)
    await wrapper.find('#firstName').setValue('Max')
    await wrapper.find('#lastName').setValue('Doe')
    await wrapper.find('#phoneNumber').setValue('0791234567')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('international format')
  })

  it('should call updateProfile and navigate to map on valid submit without phone', async () => {
    mockUpdateProfile.mockResolvedValue(undefined)
    const wrapper = mount(OnboardingPage)
    await wrapper.find('#firstName').setValue('Max')
    await wrapper.find('#lastName').setValue('Doe')
    await wrapper.find('form').trigger('submit')
    expect(mockUpdateProfile).toHaveBeenCalledWith({ firstName: 'Max', lastName: 'Doe' })
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith({ name: 'map' }))
  })

  it('should trigger phone verification when phone is provided on submit', async () => {
    mockUpdateProfile.mockResolvedValue(undefined)
    mockSendPhoneVerification.mockResolvedValue(undefined)
    const wrapper = mount(OnboardingPage)
    await wrapper.find('#firstName').setValue('Max')
    await wrapper.find('#lastName').setValue('Doe')
    await wrapper.find('#phoneNumber').setValue('+41791234567')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(mockSendPhoneVerification).toHaveBeenCalledWith('+41791234567'))
    expect(wrapper.find('.phone-verification-stub').exists()).toBe(true)
  })

  it('should set skippedOnboarding in localStorage and navigate to map on skip', async () => {
    const wrapper = mount(OnboardingPage)
    await wrapper.find('.skip-btn').trigger('click')
    expect(localStorage.getItem('skippedOnboarding')).toBe('true')
    expect(mockPush).toHaveBeenCalledWith({ name: 'map' })
  })

  it('should display reminder text about profile benefits', () => {
    const wrapper = mount(OnboardingPage)
    expect(wrapper.text()).toContain('complete')
  })
})
