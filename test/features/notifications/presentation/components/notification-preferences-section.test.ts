import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import NotificationPreferencesSection from '@/features/notifications/presentation/components/notification-preferences-section.vue'
import { useNotificationCapability } from '@/features/notifications/presentation/composables/use-notification-capability'
import { useNotificationsStore } from '@/features/notifications/presentation/stores/notifications-store'

vi.mock('@/features/notifications/presentation/composables/use-notification-capability', () => ({
  useNotificationCapability: vi.fn(),
}))

function mountComponent(prefsOverride = {}, storeOverride: Record<string, unknown> = {}) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      notifications: {
        prefs: {
          notifEmailEnabled: true,
          notifMutedTypes: [],
          ...prefsOverride,
        },
        pushPermission: 'default',
        pushEnabled: true,
        isLoading: false,
        error: null,
        ...storeOverride,
      },
    },
  })
  return mount(NotificationPreferencesSection, {
    global: { plugins: [pinia] },
  })
}

describe('notificationPreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNotificationCapability).mockReturnValue({
      pushSupported: ref(true),
      requiresPwaInstall: ref(false),
    })
  })

  it('should render push and email toggle labels', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('notifications.pushLabel')
    expect(wrapper.text()).toContain('notifications.emailLabel')
  })

  it('should show the inbox hint when push is off on this device and email is off', () => {
    const wrapper = mountComponent({ notifEmailEnabled: false }, { pushEnabled: false })
    expect(wrapper.find('[data-testid="all-off-hint"]').text()).toBe('notifications.allOffDisclaimer')
  })

  it('should hide the hint when only this device has push on', () => {
    const wrapper = mountComponent({ notifEmailEnabled: false }, { pushEnabled: true })
    expect(wrapper.find('[data-testid="all-off-hint"]').exists()).toBe(false)
  })

  it('should disable the push toggle while offline (subscribing needs the network)', async () => {
    const { isOnline } = await import('@/core/offline/use-online-status')
    isOnline.value = false
    try {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="push-toggle"]').attributes('disabled')).toBeDefined()
    }
    finally {
      isOnline.value = true
    }
  })

  it('should show compact unavailable badge when requiresPwaInstall is true', () => {
    vi.mocked(useNotificationCapability).mockReturnValue({
      pushSupported: ref(false),
      requiresPwaInstall: ref(true),
    })

    const wrapper = mountComponent()

    expect(wrapper.find('.unavailable').exists()).toBe(true)
    expect(wrapper.find('.unavailable__label').text()).toBe('notifications.pushUnavailable')
    const infoBtn = wrapper.find('.unavailable__info')
    expect(infoBtn.exists()).toBe(true)
    expect(infoBtn.attributes('aria-label')).toBe('notifications.installHint')
    expect(infoBtn.classes()).not.toContain('unavailable__info--warning')
    expect(wrapper.find('input[type="checkbox"][data-push]').exists()).toBe(false)
  })

  it('should show compact unavailable warning badge when push permission is denied', () => {
    const wrapper = mountComponent({}, { pushPermission: 'denied' })

    expect(wrapper.find('.unavailable').exists()).toBe(true)
    expect(wrapper.find('.unavailable__label').text()).toBe('notifications.pushUnavailable')
    const infoBtn = wrapper.find('.unavailable__info')
    expect(infoBtn.exists()).toBe(true)
    expect(infoBtn.attributes('aria-label')).toBe('notifications.deniedHint')
    expect(infoBtn.classes()).toContain('unavailable__info--warning')
  })

  it('should render push toggle when push is supported and not denied', () => {
    const wrapper = mountComponent()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.find('.unavailable').exists()).toBe(false)
  })

  it('should render friend_requests type toggle label', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('notifications.type.friend_requests')
  })

  it('should call setEmailEnabled when email toggle changes', async () => {
    const wrapper = mountComponent()
    const store = useNotificationsStore()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    // Push toggle = 0, email toggle = 1
    await checkboxes.at(1)?.trigger('change')

    expect(store.setEmailEnabled).toHaveBeenCalled()
  })

  it('should call setTypeMuted when type toggle changes', async () => {
    const wrapper = mountComponent()
    const store = useNotificationsStore()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    // Push toggle = 0, email toggle = 1, friend_requests type = 2
    await checkboxes.at(2)?.trigger('change')

    expect(store.setTypeMuted).toHaveBeenCalled()
  })
})
