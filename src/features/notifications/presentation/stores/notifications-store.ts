import type { NotificationPreferences, NotificationType } from '../../domain/entities/notification-preferences'
import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { flushThenRefetch } from '@/core/offline/reconnect'
import { registerReplay } from '@/core/offline/replay'
import { isOnline } from '@/core/offline/use-online-status'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { NotificationPreferencesRepositoryImpl } from '../../data/repositories/notification-preferences-repository-impl'
import { useWebPush } from '../composables/use-web-push'

const prefsRepository = new NotificationPreferencesRepositoryImpl()

export const useNotificationsStore = defineStore('notifications', () => {
  const logger = useLogger('NotificationsStore')
  const authStore = useAuthStore()

  const prefs = ref<NotificationPreferences | null>(null)
  const pushPermission = ref<NotificationPermission | null>(null)
  /** Whether THIS browser has push on (permission granted + live subscription). */
  const pushEnabled = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const { subscribe, unsubscribe, ensureSubscription, currentSubscription } = useWebPush()

  function refreshPermission() {
    if ('Notification' in window)
      pushPermission.value = Notification.permission
  }

  async function loadPrefs() {
    const userId = authStore.currentUser?.id
    if (!userId)
      return

    refreshPermission()
    currentSubscription()
      .then((s) => { pushEnabled.value = s !== null })
      .catch(err => logger.warn('Failed to read push subscription', err))
    isLoading.value = true
    error.value = null
    try {
      // Hydrate from cache then (online) refetch (offline-app-cache-sync D3). Prefs are a
      // singleton row but ride the collection-shaped mutate seam, so cache as a one-element
      // array and unwrap — the cache/queue write-through and the hydrate agree on shape.
      await cachedLoad<NotificationPreferences[]>(
        `notif-prefs:${userId}`,
        async () => {
          const fetched = await prefsRepository.getPreferences(userId)
          return fetched ? [fetched] : []
        },
        (rows) => { prefs.value = rows[0] ?? null },
      )
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load notification preferences'
      logger.error('Failed to load notification prefs', err)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * The single notif-prefs write seam (offline-write-sync): build the whole desired prefs
   * and route through `mutate`. Online runs `run`; offline it enqueues the desired prefs,
   * applies optimistically, and cache-write-throughs — so a toggle syncs on reconnect.
   *
   * Prefs live in disjoint columns of the same `user_profile` row as `kind:'profile'`, so
   * they queue under their OWN entityId (`notif:<uid>`) and replay independently. `baseSnapshot`
   * is the last-synced prefs so an offline toggle-and-toggle-back annihilates in `coalesce`.
   */
  function persistPrefs(updated: NotificationPreferences, run: () => Promise<void>) {
    const userId = authStore.currentUser!.id
    return mutate<NotificationPreferences>({
      run,
      intent: {
        entityId: `notif:${userId}`,
        kind: 'notif-prefs',
        op: 'update',
        payload: updated,
        baseSnapshot: prefs.value,
      },
      cacheKey: `notif-prefs:${userId}`,
      current: prefs.value ? [prefs.value] : [],
      apply: () => [updated],
      assign: (rows) => { prefs.value = rows[0] ?? null },
    })
  }

  /**
   * Push is per device (#148): this toggles THIS browser only and never queues — subscribing
   * needs the network, so the toggle is disabled offline. Other devices are untouched.
   */
  async function setPushEnabled(enabled: boolean) {
    if (!authStore.currentUser || !isOnline.value)
      return
    if (enabled) {
      pushEnabled.value = await subscribe()
      refreshPermission()
    }
    else {
      await unsubscribe()
      pushEnabled.value = false
    }
  }

  /**
   * Sign-out: drop this device's registration while the session can still delete it.
   * Best-effort and bounded — `serviceWorker.ready` never settles without a registered
   * worker, and sign-out must not hang on it.
   */
  async function removeThisDevice() {
    // ponytail: fixed 3 s cap; a stuck cleanup leaves one stale row the Worker prunes on 410.
    await Promise.race([unsubscribe(), new Promise(resolve => setTimeout(resolve, 3000))])
    pushEnabled.value = false
  }

  async function setEmailEnabled(enabled: boolean) {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value)
      return

    const updated: NotificationPreferences = { ...prefs.value, notifEmailEnabled: enabled }
    try {
      await persistPrefs(updated, async () => {
        await prefsRepository.updatePreferences(userId, updated)
        prefs.value = updated
      })
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
      await persistPrefs(updated, async () => {
        await prefsRepository.updatePreferences(userId, updated)
        prefs.value = updated
      })
    }
    catch (err) {
      logger.error('Failed to update muted types', err)
      throw err
    }
  }

  /**
   * Replay a queued notif-prefs write on reconnect (DC3). No last-write-wins timestamp gate —
   * these columns are disjoint from the `kind:'profile'` entity yet share the row's
   * `updated_at`, so a strict gate would false-conflict the user's OWN concurrent profile
   * replay; prefs are low-stakes so the replayed write (the wall-clock latest) wins.
   * Entries queued by older builds may carry `notifPushEnabled`; it is ignored (push is
   * per device now and never queued).
   */
  async function replayNotifPrefs(entry: WriteQueueEntry): Promise<void> {
    const userId = entry.entityId.replace(/^notif:/, '')
    await prefsRepository.updatePreferences(userId, entry.payload as NotificationPreferences)
  }
  registerReplay('notif-prefs', replayNotifPrefs)

  async function ensurePushSubscription() {
    if (!authStore.currentUser)
      return
    pushEnabled.value = await ensureSubscription()
  }

  function clear() {
    prefs.value = null
    pushEnabled.value = false
    error.value = null
  }

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `notification-settings-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [{ event: '*', table: 'user_profile', filter: `id=eq.${uid}` }]
    },
    onChange: loadPrefs,
    // DC4: drain the queue BEFORE the reconnect refetch so a replayed offline toggle lands
    // server-side before the fresh snapshot overwrites the store.
    onSubscribed: () => flushThenRefetch(loadPrefs),
  })

  watch(
    () => authStore.isAuthenticated,
    (v) => {
      if (!v)
        clear()
    },
  )

  return {
    prefs,
    pushPermission,
    pushEnabled,
    isLoading,
    error,
    loadPrefs,
    setPushEnabled,
    removeThisDevice,
    setEmailEnabled,
    setTypeMuted,
    ensurePushSubscription,
    clear,
  }
})
