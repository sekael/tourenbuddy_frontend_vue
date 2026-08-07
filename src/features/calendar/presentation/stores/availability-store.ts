import type { AvailabilityRow } from '@/features/calendar/data/models/availability'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { cachedLoad } from '@/core/offline/cached-load'
import { mutate } from '@/core/offline/mutate'
import { useRealtimeBroadcast } from '@/core/realtime/use-realtime-broadcast'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { SupabaseAvailabilityRepository } from '@/features/calendar/data/repositories/availability-repository-impl'
import { todayKey } from '@/features/calendar/domain/calendar-dates'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const repository = new SupabaseAvailabilityRepository()

export const useAvailabilityStore = defineStore('availability', () => {
  const logger = useLogger('AvailabilityStore')
  const authStore = useAuthStore()
  const friendshipsStore = useFriendshipsStore()

  // Saved own availability (dayKeys), drives the view-mode overlay.
  const savedDays = ref<Set<string>>(new Set())
  // In-edit working selection; the baseline is the set captured on enterEdit.
  const workingDays = ref<Set<string>>(new Set())
  let baseline = new Set<string>()

  // Accepted friends' future availability (raw rows), synced via realtime. The
  // component derives the per-day, per-friend view; the store just holds the set.
  const friendDays = ref<AvailabilityRow[]>([])
  // Monotonic token: only the latest-initiated loadFriends assigns, so a slow
  // stale refetch (racing an optimistic friend-set change) can't blank the list.
  let friendsSeq = 0

  const editing = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // What the calendar renders as available: the live working set while editing,
  // otherwise the saved set.
  const displayDays = computed(() => (editing.value ? workingDays.value : savedDays.value))

  /** Load own future availability — call on Planned view mount. */
  async function load() {
    // No uid early-return: load only runs authenticated in practice (Planned mount /
    // realtime onSubscribed), and skipping would break the cache key. ponytail: the
    // uid just namespaces the cache (design D1); RLS is the real per-user gate.
    const uid = authStore.currentUser?.id
    loading.value = true
    error.value = null
    try {
      // Cache the raw day-key array; the store holds it as a Set (design D1/D3).
      await cachedLoad(
        `availability:${uid}`,
        () => repository.listOwnFrom(todayKey()),
        (days) => { savedDays.value = new Set(days) },
      )
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load availability'
      logger.error('Failed to load availability', err)
    }
    finally {
      loading.value = false
    }
  }

  /** Load accepted friends' future availability — synced live thereafter. */
  async function loadFriends() {
    if (!authStore.currentUser?.id)
      return
    const req = ++friendsSeq
    try {
      const rows = await repository.listFriendsFrom(todayKey())
      if (req === friendsSeq)
        friendDays.value = rows
    }
    catch (err) {
      logger.error('Failed to load friend availability', err)
    }
  }

  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  // Own availability across the viewer's devices: postgres_changes on own rows.
  useRealtimeSubscription({
    key: () => {
      const uid = authStore.currentUser?.id
      return authStore.isAuthenticated && uid ? `availability-${uid}` : null
    },
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      return uid ? [{ event: '*', table: 'user_availability', filter: `user_id=eq.${uid}` }] : []
    },
    onChange: load,
    onSubscribed: () => load(),
  })

  // Friends' availability: a friend's write pings availability:<uid> to refetch.
  useRealtimeBroadcast({
    topic: () => {
      const uid = authStore.currentUser?.id
      return uid ? `availability:${uid}` : null
    },
    enabled: () => realtimeEnabled.value,
    event: 'refetch',
    onMessage: loadFriends,
    onSubscribed: loadFriends,
  })

  // Friend-set change (add / remove) → refetch, dropping any ex-friend's rows.
  watch(
    () => [...friendshipsStore.friendUserIds].sort().join(','),
    (n, o) => {
      if (n !== o)
        loadFriends()
    },
  )

  // accept / removeFriendship mutate friendUserIds optimistically (pre-commit), so
  // the watch above can fire before RLS sees the row — refetch post-commit too.
  friendshipsStore.$onAction(({ name, after }) => {
    if (name !== 'accept' && name !== 'removeFriendship')
      return
    after(() => loadFriends())
  })

  // Clear friend state on sign-out (channel teardown handled by the primitives).
  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed) {
        friendDays.value = []
        friendsSeq++
      }
    },
  )

  // Store is created lazily by the first Planned view; if the session is already
  // live, the friend-broadcast onSubscribed will refetch, but kick an initial load
  // so friends show even before the channel subscribes.
  if (authStore.isAuthenticated)
    void loadFriends()

  /** Enter edit mode, seeding the working set from what's already loaded. */
  function enterEdit() {
    baseline = new Set(savedDays.value)
    workingDays.value = new Set(savedDays.value)
    editing.value = true
  }

  /** Toggle a day in the working set. Callers gate selectability (future-only). */
  function toggleDay(key: string) {
    if (workingDays.value.has(key))
      workingDays.value.delete(key)
    else
      workingDays.value.add(key)
  }

  /** Discard the in-progress edit (Cancel, or navigating away). */
  function cancel() {
    editing.value = false
    workingDays.value = new Set()
  }

  /**
   * Persist the edit as a diff (added/removed vs the pre-edit baseline) via one
   * atomic RPC, then leave edit mode. On failure edit mode stays open with the
   * working set intact so the user can retry without redoing their selection.
   */
  async function save() {
    return mutate(async () => {
      error.value = null
      const added = [...workingDays.value].filter(day => !baseline.has(day))
      const removed = [...baseline].filter(day => !workingDays.value.has(day))
      if (added.length === 0 && removed.length === 0) {
        editing.value = false
        return
      }

      saving.value = true
      try {
        await repository.applyDiff(added, removed)
        await load() // reconcile with what actually persisted
        editing.value = false
      }
      catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to save availability'
        logger.error('Failed to save availability', err)
      }
      finally {
        saving.value = false
      }
    })
  }

  return {
    savedDays,
    workingDays,
    displayDays,
    friendDays,
    editing,
    loading,
    saving,
    error,
    load,
    loadFriends,
    enterEdit,
    toggleDay,
    cancel,
    save,
  }
})
