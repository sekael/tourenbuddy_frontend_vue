import type {
  TourLinkMember,
  TourLinkRequest,
} from '@/features/tour-links/domain/entities/tour-link'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import {
  notifyGroupMembershipEvent,
  notifyTourLinkRequestEvent,
} from '@/features/notifications/data/notify-dispatch'
import { TourLinksRepositoryImpl } from '@/features/tour-links/data/repositories/tour-links-repository-impl'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const logger = useLogger('tour-links-store')
const repository = new TourLinksRepositoryImpl()

export const useTourLinksStore = defineStore('tour-links', () => {
  const authStore = useAuthStore()
  const toursStore = useToursStore()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const members = ref<TourLinkMember[]>([])
  const pendingRequests = ref<TourLinkRequest[]>([])
  /**
   * Group ids for friend tours the caller can't see via tour_link_member RLS
   * (i.e. friend tours sitting in a group with no owned-tour overlap). Drives
   * pre-filtering of merge-forbidden link candidates.
   */
  const friendGroupIdByTourId = ref<Map<string, string>>(new Map())

  /** group_id → ordered tour ids in that group. */
  const groupMembersByGroupId = computed(() => {
    const map = new Map<string, string[]>()
    for (const m of members.value) {
      const list = map.get(m.groupId) ?? []
      list.push(m.tourId)
      map.set(m.groupId, list)
    }
    return map
  })

  /**
   * tour_id → group_id (if grouped). Merges own-visible member rows with the
   * SECURITY-DEFINER-fetched friend tour group ids so the client has a complete
   * picture of which collision candidates would trigger a merge-forbidden.
   */
  const groupIdByTourId = computed(() => {
    const map = new Map<string, string>()
    for (const m of members.value)
      map.set(m.tourId, m.groupId)
    for (const [tourId, groupId] of friendGroupIdByTourId.value) {
      if (!map.has(tourId))
        map.set(tourId, groupId)
    }
    return map
  })

  /** tour_id → sibling tour ids (excludes self). */
  const siblingsByTourId = computed(() => {
    const map = new Map<string, string[]>()
    for (const m of members.value) {
      const groupTours = groupMembersByGroupId.value.get(m.groupId) ?? []
      map.set(m.tourId, groupTours.filter(id => id !== m.tourId))
    }
    return map
  })

  /** tour_id → pending requests touching that tour. */
  const requestsByTourId = computed(() => {
    const map = new Map<string, TourLinkRequest[]>()
    for (const r of pendingRequests.value) {
      for (const tid of [r.initiatorTourId, r.targetTourId]) {
        const list = map.get(tid) ?? []
        list.push(r)
        map.set(tid, list)
      }
    }
    return map
  })

  async function fetchAll() {
    const ownedTourIds = toursStore.tours.map(t => t.id)
    const friendTourIds = toursStore.friendTours.map(t => t.id)
    if (ownedTourIds.length === 0) {
      members.value = []
      pendingRequests.value = []
      friendGroupIdByTourId.value = new Map()
      return
    }
    loading.value = true
    error.value = null
    try {
      const [m, r, fg] = await Promise.all([
        repository.listGroupsForTours(ownedTourIds),
        repository.listPendingRequestsForTours(ownedTourIds),
        friendTourIds.length > 0
          ? repository.listFriendTourGroupIds(friendTourIds)
          : Promise.resolve([]),
      ])
      members.value = m
      pendingRequests.value = r
      const map = new Map<string, string>()
      for (const row of fg)
        map.set(row.tourId, row.groupId)
      friendGroupIdByTourId.value = map
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'failed_to_load_tour_links'
      logger.error('fetchAll failed', err)
    }
    finally {
      loading.value = false
    }
  }

  async function createRequest(initiatorTourId: string, targetTourId: string): Promise<string> {
    const id = await repository.createRequest(initiatorTourId, targetTourId)
    notifyTourLinkRequestEvent(id, 'created')
    await fetchAll()
    return id
  }

  async function acceptRequest(requestId: string) {
    const result = await repository.acceptRequest(requestId)
    notifyTourLinkRequestEvent(requestId, 'accepted')
    // The target tour just joined a group → notify pre-existing members.
    notifyGroupMembershipEvent(result.groupId, 'joined', {
      affectedTourId: result.addedTourIds[result.addedTourIds.length - 1],
    })
    await fetchAll()
    return result
  }

  async function declineRequest(requestId: string) {
    await repository.declineRequest(requestId)
    notifyTourLinkRequestEvent(requestId, 'declined')
    await fetchAll()
  }

  async function withdrawRequest(requestId: string) {
    await repository.withdrawRequest(requestId)
    // Per design: withdraws SHALL NOT trigger a notification.
    await fetchAll()
  }

  function clear() {
    members.value = []
    pendingRequests.value = []
    friendGroupIdByTourId.value = new Map()
    error.value = null
  }

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return uid ? `tour-links-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    // Both tables: request rows drive banner state, member rows drive linked
    // sibling pills and the map chain badge. Without the member binding, the
    // non-acceptor side never learns about a successful accept until reload.
    bindings: () => [
      { event: '*', table: 'tour_link_request' },
      { event: '*', table: 'tour_link_member' },
    ],
    onChange: () => {
      fetchAll().catch(err => logger.warn('refetch on realtime change failed', err))
    },
    onSubscribed: () => {
      fetchAll().catch(err => logger.warn('initial fetch failed', err))
    },
  })

  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed)
        clear()
    },
  )

  // Tours load async; realtime onSubscribed may fire while toursStore.tours is
  // still empty, causing fetchAll's early-return to leave requests/members empty
  // permanently. Re-run fetchAll when the owned-tour set arrives or changes so
  // pending request banners survive page reload.
  watch(
    () => toursStore.tours.map(t => t.id).sort().join(','),
    (newKey, oldKey) => {
      if (newKey && newKey !== oldKey)
        fetchAll().catch(err => logger.warn('refetch on tours change failed', err))
    },
  )

  // Same reasoning for friendTours: they load async; need to refetch friend
  // group ids once they arrive so collision-notice can pre-filter merge-forbidden.
  watch(
    () => toursStore.friendTours.map(t => t.id).sort().join(','),
    (newKey, oldKey) => {
      if (newKey !== oldKey)
        fetchAll().catch(err => logger.warn('refetch on friendTours change failed', err))
    },
  )

  return {
    loading,
    error,
    members,
    pendingRequests,
    groupMembersByGroupId,
    groupIdByTourId,
    siblingsByTourId,
    requestsByTourId,
    fetchAll,
    createRequest,
    acceptRequest,
    declineRequest,
    withdrawRequest,
    clear,
  }
})
