import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingPage from '@/features/user/presentation/pages/onboarding-page.vue'

const {
  mockUpdateProfile,
  mockSendPhoneVerification,
  mockSkipOnboarding,
  mockLoadProfile,
  mockProfileStore,
} = vi.hoisted(() => {
  const store = {
    _profile: null as { id: string, firstName: string | null, lastName: string | null } | null,
    get profile() {
      return store._profile
    },
    updateProfile: vi.fn(),
    sendPhoneVerification: vi.fn(),
    skipOnboarding: vi.fn(),
    loadProfile: vi.fn(),
    fullProfile: null,
  }
  return {
    mockUpdateProfile: store.updateProfile,
    mockSendPhoneVerification: store.sendPhoneVerification,
    mockSkipOnboarding: store.skipOnboarding,
    mockLoadProfile: store.loadProfile,
    mockProfileStore: store,
  }
})

vi.mock('@/features/user/presentation/stores/user-profile-store', () => ({
  useUserProfileStore: vi.fn().mockReturnValue(mockProfileStore),
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
    mockProfileStore._profile = null
    mockLoadProfile.mockResolvedValue(undefined)
  })

  it('should call loadProfile on mount when profile is not loaded', async () => {
    mockProfileStore._profile = null
    mount(OnboardingPage)
    await vi.waitFor(() => expect(mockLoadProfile).toHaveBeenCalled())
  })

  it('should not call loadProfile on mount when profile is already loaded', async () => {
    mockProfileStore._profile = { id: 'user-123', firstName: null, lastName: null }
    mount(OnboardingPage)
    await new Promise(r => setTimeout(r, 0))
    expect(mockLoadProfile).not.toHaveBeenCalled()
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

  it('should call skipOnboarding and navigate to map when skip is clicked', async () => {
    const wrapper = mount(OnboardingPage)
    await wrapper.find('.skip-btn').trigger('click')
    expect(mockSkipOnboarding).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith({ name: 'map' })
  })

  it('should display reminder text about profile benefits', () => {
    const wrapper = mount(OnboardingPage)
    expect(wrapper.text()).toContain('complete')
  })
})
