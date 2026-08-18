import type { NotificationPreferences, NotificationType } from '../../domain/entities/notification-preferences'
import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { flushThenRefetch } from '@/core/offline/reconnect'
import { registerReplay } from '@/core/offline/replay'
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

  async function setPushEnabled(enabled: boolean) {
    const userId = authStore.currentUser?.id
    if (!userId || !prefs.value)
      return

    const updated: NotificationPreferences = { ...prefs.value, notifPushEnabled: enabled }
    try {
      // Online: persist + reconcile the browser/server push subscription (with revert on
      // denied). Offline: the subscription can't be registered, so only the flag is queued —
      // the subscription is reconciled on replay, mirroring this body.
      await persistPrefs(updated, () => reconcilePushOnline(userId, updated))
    }
    catch (err) {
      logger.error('Failed to update push pref', err)
      throw err
    }
  }

  /** Online push write: update the row, subscribe/unsubscribe, revert the row if a subscribe is denied. */
  async function reconcilePushOnline(userId: string, updated: NotificationPreferences) {
    await prefsRepository.updatePreferences(userId, updated)
    prefs.value = updated
    if (updated.notifPushEnabled) {
      const ok = await subscribe(userId)
      if (!ok) {
        const reverted: NotificationPreferences = { ...updated, notifPushEnabled: false }
        await prefsRepository.updatePreferences(userId, reverted)
        prefs.value = reverted
      }
      refreshPermission()
    }
    else {
      await unsubscribe(userId)
    }
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
   * Replay a queued notif-prefs write on reconnect (DC3): upsert the flags, then reconcile
   * the browser/server push subscription to match. No last-write-wins timestamp gate — these
   * columns are disjoint from the `kind:'profile'` entity yet share the row's `updated_at`, so
   * a strict gate would false-conflict the user's OWN concurrent profile replay; prefs are
   * low-stakes so the replayed write (the wall-clock latest) wins unconditionally.
   */
  async function replayNotifPrefs(entry: WriteQueueEntry): Promise<void> {
    const userId = entry.entityId.replace(/^notif:/, '')
    const desired = entry.payload as NotificationPreferences
    await prefsRepository.updatePreferences(userId, desired)
    // Best-effort: prefs are already persisted; a failed (un)subscribe must not fail replay.
    if (desired.notifPushEnabled) {
      const ok = await subscribe(userId)
      if (!ok)
        await prefsRepository.updatePreferences(userId, { ...desired, notifPushEnabled: false })
    }
    else {
      await unsubscribe(userId)
    }
  }
  registerReplay('notif-prefs', replayNotifPrefs)

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
