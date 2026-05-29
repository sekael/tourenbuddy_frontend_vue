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
    // Refresh members BEFORE notifying so we can resolve pre-existing
    // recipients' own tour names for the {tour} placeholder. addedTourIds
    // only lists newly-inserted rows; pre-existing members (the actual
    // notification audience) need a full member list.
    await fetchAll()
    const affectedTourId = result.addedTourIds[result.addedTourIds.length - 1]
    const groupTourIds = groupMembersByGroupId.value.get(result.groupId) ?? []
    const recipientTourNames: Record<string, string> = {}
    for (const tid of groupTourIds) {
      if (tid === affectedTourId)
        continue
      const t = toursStore.tours.find(x => x.id === tid) ?? toursStore.friendTours.find(x => x.id === tid)
      if (t?.name)
        recipientTourNames[t.userId] = t.name
    }
    notifyGroupMembershipEvent(result.groupId, 'joined', {
      affectedTourId,
      recipientTourNames,
    })
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

  /**
   * Snapshot groups that will be affected when the caller's friendship with
   * `otherUserId` is deleted, BEFORE the DB trigger runs. The friendship-delete
   * trigger evicts every member tour owned by either party from each shared
   * group, then the dissolution trigger drops the group when count < 2. By
   * the time the Worker could fetch live members, those rows are gone — so
   * we precompute recipients here and pass them explicitly to the notify hook.
   *
   * Returns one entry per affected group with the post-eviction event type
   * and the userIds that need to be told (excluding the caller; the Worker
   * also drops the caller defensively).
   */
  function snapshotFriendshipRemovalNotifications(otherUserId: string): Array<{
    groupId: string
    event: 'evicted_external' | 'dissolved'
    recipients: string[]
    recipientTourNames: Record<string, string>
  }> {
    const uid = authStore.currentUser?.id
    if (!uid)
      return []

    // tour_id → {userId, name} resolver. Own tours + friend tours both expose
    // userId + name on the Tour entity; friend tours of the soon-ex-friend
    // are still visible at the moment we read this (RLS check happens at
    // query time, not delete time).
    const tourMeta = new Map<string, { userId: string, name: string }>()
    for (const t of toursStore.tours) tourMeta.set(t.id, { userId: t.userId, name: t.name ?? '' })
    for (const t of toursStore.friendTours) tourMeta.set(t.id, { userId: t.userId, name: t.name ?? '' })

    const out: Array<{
      groupId: string
      event: 'evicted_external' | 'dissolved'
      recipients: string[]
      recipientTourNames: Record<string, string>
    }> = []

    for (const [groupId, tourIds] of groupMembersByGroupId.value) {
      const memberMeta = tourIds
        .map(tid => tourMeta.get(tid))
        .filter((m): m is { userId: string, name: string } => Boolean(m))
      const memberUserIds = memberMeta.map(m => m.userId)
      const hasUid = memberUserIds.includes(uid)
      const hasOther = memberUserIds.includes(otherUserId)
      if (!hasUid || !hasOther)
        continue

      const remaining = memberUserIds.filter(u => u !== uid && u !== otherUserId)
      const event: 'evicted_external' | 'dissolved' = remaining.length >= 2 ? 'evicted_external' : 'dissolved'
      const recipients = Array.from(new Set([...remaining, otherUserId])).filter(u => u !== uid)
      if (recipients.length === 0)
        continue

      // Each recipient gets the name of THEIR OWN tour in this group — that's
      // the title they recognise. First match wins (a recipient owning two
      // colliding tours in the same group is pathological but harmless).
      const recipientTourNames: Record<string, string> = {}
      for (const r of recipients) {
        const own = memberMeta.find(m => m.userId === r)
        if (own?.name)
          recipientTourNames[r] = own.name
      }
      out.push({ groupId, event, recipients, recipientTourNames })
    }
    return out
  }

  /**
   * Capture the audience for a potential eviction of `tourId` BEFORE a tour
   * mutation runs. The DB triggers (fn_evict_member_on_tour_change, member
   * cascade-on-delete) wipe the member rows + may dissolve the group inside
   * the same txn, so by the time we'd ask the server who to notify, the rows
   * are gone. We snapshot pre-existing sibling user_ids + their own tour
   * names here, then fire after the mutation commits (with a check, where
   * the eviction is conditional).
   *
   * Returns null when the tour is not in any group → no possible eviction.
   */
  function snapshotTourGroupContext(tourId: string): {
    groupId: string
    recipients: string[]
    recipientTourNames: Record<string, string>
  } | null {
    const groupId = groupIdByTourId.value.get(tourId)
    if (!groupId)
      return null
    const groupTourIds = groupMembersByGroupId.value.get(groupId) ?? []
    const siblingIds = groupTourIds.filter(id => id !== tourId)
    if (siblingIds.length === 0)
      return null

    const recipients: string[] = []
    const recipientTourNames: Record<string, string> = {}
    for (const sid of siblingIds) {
      const t = toursStore.tours.find(x => x.id === sid) ?? toursStore.friendTours.find(x => x.id === sid)
      if (!t)
        continue
      recipients.push(t.userId)
      if (t.name)
        recipientTourNames[t.userId] = t.name
    }
    if (recipients.length === 0)
      return null
    return { groupId, recipients, recipientTourNames }
  }

  /**
   * Fire dissolution/eviction notifications unconditionally from a prior
   * snapshot. Used by the tour-delete path, where the member row is
   * guaranteed gone (FK cascade) by the time we get here.
   */
  function dispatchEvictionNotification(
    snapshot: NonNullable<ReturnType<typeof snapshotTourGroupContext>>,
  ): void {
    const event: 'dissolved' | 'evicted_external' = snapshot.recipients.length < 2 ? 'dissolved' : 'evicted_external'
    notifyGroupMembershipEvent(snapshot.groupId, event, {
      recipients: snapshot.recipients,
      recipientTourNames: snapshot.recipientTourNames,
    })
  }

  /**
   * Tour-update path: the DB only evicts if tour_type/visibility/goal crosses
   * one of the trigger predicates. Refetch then compare — if the tour left
   * its prior group, fire; else no-op.
   */
  async function dispatchEvictionIfHappened(
    snapshot: ReturnType<typeof snapshotTourGroupContext>,
    tourId: string,
  ): Promise<void> {
    if (!snapshot)
      return
    await fetchAll()
    if (groupIdByTourId.value.get(tourId) === snapshot.groupId)
      return
    dispatchEvictionNotification(snapshot)
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
      // Group changes can be triggered by a sibling's visibility flip (the
      // server trigger evicts the now-private tour). The ex-sibling's view of
      // the friend tour is stale-cached as visibility='friends' until we
      // refetch — refresh here so the collision-notice stops offering it as
      // a link candidate. friend_tours_view has no realtime binding (#198),
      // so this piggyback is currently the only push signal.
      toursStore.loadFriendTours().catch(err => logger.warn('refetch friendTours failed', err))
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
    snapshotFriendshipRemovalNotifications,
    snapshotTourGroupContext,
    dispatchEvictionNotification,
    dispatchEvictionIfHappened,
    clear,
  }
})
