import type { NotificationPreferences, NotificationType } from '../../domain/entities/notification-preferences'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { NotificationPreferencesRepositoryImpl } from '../../data/repositories/notification-preferences-repository-impl'
import { useWebPush } from '../composables/use-web-push'

const prefsRepository = new NotificationPreferencesRepositoryImpl()

export const useNotificationsStore = defineStore('notifications', () => {
  const logger = useLogger('NotificationsStore')
  const authStore = useAuthStore()

  const prefs = ref<NotificationPreferences | null>(null)
  const pushPermission = ref<NotificationPermission | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const { subscribe, unsubscribe, ensureSubscription } = useWebPush()

  function refreshPermission() {
    if ('Notification' in window)
      pushPermission.value = Notification.permission
  }

  async function loadPrefs() {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    refreshPermission()
    isLoading.value = true
    error.value = null
    try {
      prefs.value = await prefsRepository.getPreferences(userId)
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load notification preferences'
      logger.error('Failed to load notification prefs', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function setPushEnabled(enabled: boolean) {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value)
      return

    const updated: NotificationPreferences = { ...prefs.value, notifPushEnabled: enabled }

    try {
      await prefsRepository.updatePreferences(userId, updated)
      prefs.value = updated

      if (enabled) {
        const ok = await subscribe(userId)
        if (!ok) {
          // Permission denied or failed — revert
          const reverted: NotificationPreferences = { ...updated, notifPushEnabled: false }
          await prefsRepository.updatePreferences(userId, reverted)
          prefs.value = reverted
        }
        refreshPermission()
      }
      else {
        await unsubscribe()
      }
    }
    catch (err) {
      logger.error('Failed to update push pref', err)
      throw err
    }
  }

  async function setEmailEnabled(enabled: boolean) {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value)
      return

    const updated: NotificationPreferences = { ...prefs.value, notifEmailEnabled: enabled }
    try {
      await prefsRepository.updatePreferences(userId, updated)
      prefs.value = updated
    }
    catch (err) {
      logger.error('Failed to update email pref', err)
      throw err
    }
  }

  async function setTypeMuted(type: NotificationType, muted: boolean) {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value)
      return

    const currentMuted = prefs.value.notifMutedTypes
    const newMuted = muted
      ? [...new Set([...currentMuted, type])]
      : currentMuted.filter(t => t !== type)

    const updated: NotificationPreferences = { ...prefs.value, notifMutedTypes: newMuted }
    try {
      await prefsRepository.updatePreferences(userId, updated)
      prefs.value = updated
    }
    catch (err) {
      logger.error('Failed to update muted types', err)
      throw err
    }
  }

  async function ensurePushSubscription() {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value?.notifPushEnabled)
      return
    await ensureSubscription(userId)
  }

  function clear() {
    prefs.value = null
    error.value = null
  }

  return {
    prefs,
    pushPermission,
    isLoading,
    error,
    loadPrefs,
    setPushEnabled,
    setEmailEnabled,
    setTypeMuted,
    ensurePushSubscription,
    clear,
  }
})
