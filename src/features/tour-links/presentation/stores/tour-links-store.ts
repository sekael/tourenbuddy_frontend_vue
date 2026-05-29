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

  /** tour_id → group_id (if grouped). */
  const groupIdByTourId = computed(() => {
    const map = new Map<string, string>()
    for (const m of members.value)
      map.set(m.tourId, m.groupId)
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
    if (ownedTourIds.length === 0) {
      members.value = []
      pendingRequests.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const [m, r] = await Promise.all([
        repository.listGroupsForTours(ownedTourIds),
        repository.listPendingRequestsForTours(ownedTourIds),
      ])
      members.value = m
      pendingRequests.value = r
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
