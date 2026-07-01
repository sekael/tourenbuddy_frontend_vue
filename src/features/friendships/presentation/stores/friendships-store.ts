import type {
  FriendRequest,
  Friendship,
} from '@/features/friendships/data/models/friendship-schemas'
import type { FriendshipRepository } from '@/features/friendships/domain/repositories/friendship-repository'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { BlockedBySenderError } from '@/core/exceptions'
import { useLogger } from '@/core/logging/use-logger'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { FriendshipRepositoryImpl } from '@/features/friendships/data/repositories/friendship-repository-impl'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'
import {
  notifyFriendRequestReceived,
  notifyFriendRequestResponded,
  notifyGroupMembershipEvent,
} from '@/features/notifications/data/notify-dispatch'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'

type FriendRequestVM = FriendRequest & { _optimistic?: boolean }

const repository: FriendshipRepository = new FriendshipRepositoryImpl()

export const useFriendshipsStore = defineStore('friendships', () => {
  const logger = useLogger('FriendshipsStore')
  const authStore = useAuthStore()

  const incomingRequests = ref<FriendRequestVM[]>([])
  const outgoingRequests = ref<FriendRequestVM[]>([])
  const friendships = ref<Friendship[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** userId → E.164 phone, populated by all phone-lookup RPCs. */
  const userIdToPhoneMap = ref(new Map<string, string>())
  /** userId → profile name, populated by get_user_names_by_ids RPC. */
  const userIdToNamesMap = ref(new Map<string, { firstName: string | null, lastName: string | null }>())

  /** Set of user IDs that are confirmed friends with the caller. */
  const friendUserIds = computed<Set<string>>(() => {
    const uid = authStore.currentUser?.id
    if (!uid)
      return new Set()
    return new Set(friendships.value.map(f => (f.requestUserId === uid ? f.responseUserId : f.requestUserId)))
  })

  /** Set of user IDs with whom the caller has a pending friend request (either direction). */
  const pendingRequestUserIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    for (const r of incomingRequests.value) ids.add(r.fromUserId)
    for (const r of outgoingRequests.value) ids.add(r.toUserId)
    return ids
  })

  /** The current user's pending incoming request from `userId`, or null. */
  function incomingRequestFrom(userId: string): FriendRequest | null {
    return incomingRequests.value.find(r => r.fromUserId === userId) ?? null
  }

  function currentUserHasAnyRelationship(): { hasPending: boolean, hasFriendship: boolean } {
    return {
      hasPending: incomingRequests.value.length > 0 || outgoingRequests.value.length > 0,
      hasFriendship: friendships.value.length > 0,
    }
  }

  /** Whether the current user has a verified phone (drives friendship UX gates). */
  const isPhoneVerified = computed(() => authStore.currentUser?.phone_confirmed_at != null)

  /**
   * Reconcile server rows with current local list:
   * - Drop in-flight optimistic rows whose (fromUserId, toUserId) pair now exists on server
   * - Keep in-flight optimistic rows not yet confirmed by server
   * - Always include all server rows
   */
  function reconcileRequests(serverRows: FriendRequest[], current: FriendRequestVM[]): FriendRequestVM[] {
    const serverPairs = new Set(serverRows.map(r => `${r.fromUserId}:${r.toUserId}`))
    const serverIds = new Set(serverRows.map(r => r.id))
    const survivingOptimistic = current.filter(
      r => r._optimistic && !serverPairs.has(`${r.fromUserId}:${r.toUserId}`) && !serverIds.has(r.id),
    )
    return [...serverRows, ...survivingOptimistic]
  }

  async function fetchAll() {
    if (!authStore.isAuthenticated || !isPhoneVerified.value)
      return

    isLoading.value = true
    error.value = null
    try {
      const [allRequests, fships] = await Promise.all([
        repository.listIncoming(),
        repository.listFriendships(),
      ])
      const uid = authStore.currentUser!.id
      const serverIncoming = allRequests.filter(r => r.toUserId === uid)
      const serverOutgoing = allRequests.filter(r => r.fromUserId === uid)
      incomingRequests.value = reconcileRequests(serverIncoming, incomingRequests.value)
      outgoingRequests.value = reconcileRequests(serverOutgoing, outgoingRequests.value)
      // Dedupe friendships by composite PK (request_user_id, response_user_id)
      const seen = new Set<string>()
      friendships.value = fships.filter((f) => {
        const key = `${f.requestUserId}:${f.responseUserId}`
        if (seen.has(key))
          return false
        seen.add(key)
        return true
      })
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load friendships'
      logger.error('Failed to fetch friendships', err)
    }
    finally {
      isLoading.value = false
    }
  }

  function debounce(fn: () => void, ms: number) {
    let timer: ReturnType<typeof setTimeout> | null = null
    const debounced = () => {
      if (timer !== null)
        clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn()
      }, ms)
    }
    debounced.cancel = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }
    return debounced
  }

  const scheduleRefetch = debounce(fetchAll, 150)

  async function sendRequest(toUserId: string): Promise<FriendRequest | null> {
    if (!isPhoneVerified.value)
      return null

    // Optimistic: add placeholder outgoing request
    const tempId = crypto.randomUUID()
    const optimistic: FriendRequestVM = {
      id: tempId,
      fromUserId: authStore.currentUser!.id,
      toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null,
      _optimistic: true,
    }
    outgoingRequests.value = [...outgoingRequests.value, optimistic]

    try {
      const created = await repository.sendRequest(toUserId)
      outgoingRequests.value = outgoingRequests.value.filter(r => r.id !== tempId && r.id !== created.id).concat(created)
      notifyFriendRequestReceived(created.id)
      return created
    }
    catch (err) {
      outgoingRequests.value = outgoingRequests.value.filter(r => r.id !== tempId)
      if (err instanceof BlockedBySenderError) {
        useUserBlocksStore().handleSendRejectedByBlock(toUserId)
      }
      logger.error('Failed to send friend request', err)
      throw err
    }
  }

  async function accept(requestId: string): Promise<void> {
    const req = incomingRequests.value.find(r => r.id === requestId)
    if (!req)
      return

    // Optimistic: move from incoming to friendships
    incomingRequests.value = incomingRequests.value.filter(r => r.id !== requestId)
    const uid = authStore.currentUser!.id
    const optimisticFriendship: Friendship = {
      requestUserId: req.fromUserId,
      responseUserId: uid,
      createdAt: new Date().toISOString(),
      requestId,
    }
    friendships.value = [...friendships.value, optimisticFriendship]

    try {
      await repository.accept(requestId)
      notifyFriendRequestResponded(requestId)
    }
    catch (err) {
      // Rollback
      incomingRequests.value = [...incomingRequests.value, req]
      friendships.value = friendships.value.filter(
        f => !(f.requestUserId === req.fromUserId && f.responseUserId === uid && f.requestId === requestId),
      )
      logger.error('Failed to accept friend request', err)
      throw err
    }
  }

  async function deny(requestId: string): Promise<void> {
    const req = incomingRequests.value.find(r => r.id === requestId)
    incomingRequests.value = incomingRequests.value.filter(r => r.id !== requestId)

    try {
      await repository.deny(requestId)
      notifyFriendRequestResponded(requestId)
    }
    catch (err) {
      if (req)
        incomingRequests.value = [...incomingRequests.value, req]
      logger.error('Failed to deny friend request', err)
      throw err
    }
  }

  async function cancel(requestId: string): Promise<void> {
    const req = outgoingRequests.value.find(r => r.id === requestId)
    outgoingRequests.value = outgoingRequests.value.filter(r => r.id !== requestId)

    try {
      await repository.cancel(requestId)
    }
    catch (err) {
      if (req)
        outgoingRequests.value = [...outgoingRequests.value, req]
      logger.error('Failed to cancel friend request', err)
      throw err
    }
  }

  async function findUserByPhone(phone: string): Promise<string | null> {
    if (!isPhoneVerified.value)
      return null
    try {
      const uid = await repository.findUserByPhone(phone)
      if (uid) {
        const next = new Map(userIdToPhoneMap.value)
        next.set(uid, phone)
        userIdToPhoneMap.value = next
      }
      return uid
    }
    catch (err) {
      logger.error('findUserByPhone failed', err)
      return null
    }
  }

  async function findUsersByPhones(
    phones: string[],
  ): Promise<Array<{ phone: string, userId: string }>> {
    if (!isPhoneVerified.value || phones.length === 0)
      return []
    try {
      const results = await repository.findUsersByPhones(phones)
      if (results.length > 0) {
        const next = new Map(userIdToPhoneMap.value)
        for (const r of results) next.set(r.userId, r.phone)
        userIdToPhoneMap.value = next
      }
      return results
    }
    catch (err) {
      logger.error('findUsersByPhones failed', err)
      return []
    }
  }

  async function findPhonesByUserIds(userIds: string[]): Promise<void> {
    if (!isPhoneVerified.value || userIds.length === 0)
      return
    const missing = userIds.filter(id => !userIdToPhoneMap.value.has(id))
    if (missing.length === 0)
      return
    try {
      const results = await repository.findPhonesByUserIds(missing)
      if (results.length > 0) {
        const next = new Map(userIdToPhoneMap.value)
        for (const r of results) next.set(r.userId, r.phone)
        userIdToPhoneMap.value = next
      }
    }
    catch (err) {
      logger.error('findPhonesByUserIds failed', err)
    }
  }

  async function getNamesByUserIds(ids: string[]): Promise<void> {
    if (!isPhoneVerified.value || ids.length === 0)
      return
    const missing = ids.filter(id => !userIdToNamesMap.value.has(id))
    if (missing.length === 0)
      return
    try {
      const results = await repository.getNamesByUserIds(missing)
      if (results.length > 0) {
        const next = new Map(userIdToNamesMap.value)
        for (const r of results) next.set(r.userId, { firstName: r.firstName, lastName: r.lastName })
        userIdToNamesMap.value = next
      }
    }
    catch (err) {
      logger.error('getNamesByUserIds failed', err)
    }
  }

  async function removeFriendship(otherUserId: string): Promise<void> {
    const uid = authStore.currentUser?.id
    if (!uid)
      return
    const isMatch = (f: Friendship) =>
      (f.requestUserId === uid && f.responseUserId === otherUserId)
      || (f.requestUserId === otherUserId && f.responseUserId === uid)
    const removed = friendships.value.find(isMatch)
    friendships.value = friendships.value.filter(f => !isMatch(f))

    // Snapshot tour-link groups that will be cascade-evicted by the
    // friendship-delete trigger. Must happen BEFORE delete: the trigger
    // tears down members + dissolves groups in the same txn, and friend
    // tours stop being visible the moment the friendship row is gone.
    const tourLinksStore = useTourLinksStore()
    const groupNotifications = tourLinksStore.snapshotFriendshipRemovalNotifications(otherUserId)

    try {
      await repository.removeFriendship(otherUserId)
    }
    catch (err) {
      if (removed)
        friendships.value = [...friendships.value, removed]
      logger.error('Failed to remove friendship', err)
      throw err
    }

    // Delete succeeded → fire one notification per affected group with the
    // pre-eviction recipient snapshot. Best-effort; failures only warn.
    for (const n of groupNotifications) {
      notifyGroupMembershipEvent(n.groupId, n.event, {
        affectedUserId: otherUserId,
        recipients: n.recipients,
        recipientTourNames: n.recipientTourNames,
      })
    }
  }

  function clear() {
    scheduleRefetch.cancel()
    incomingRequests.value = []
    outgoingRequests.value = []
    friendships.value = []
    userIdToPhoneMap.value = new Map()
    userIdToNamesMap.value = new Map()
    error.value = null
  }

  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && isPhoneVerified.value && uid ? `friendships-${uid}` : null
  })
  const realtimeEnabled = computed(() => authStore.isAuthenticated && isPhoneVerified.value)

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => realtimeEnabled.value,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [
        { event: '*', table: 'friend_requests', filter: `to_user_id=eq.${uid}` },
        { event: '*', table: 'friend_requests', filter: `from_user_id=eq.${uid}` },
        { event: '*', table: 'friendships', filter: `request_user_id=eq.${uid}` },
        { event: '*', table: 'friendships', filter: `response_user_id=eq.${uid}` },
      ]
    },
    onChange: scheduleRefetch,
    onSubscribed: () => fetchAll(),
  })

  // Clear local state on sign-out (channel teardown handled by primitive)
  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed)
        clear()
    },
  )

  return {
    incomingRequests,
    outgoingRequests,
    friendships,
    isLoading,
    error,
    friendUserIds,
    pendingRequestUserIds,
    isPhoneVerified,
    incomingRequestFrom,
    currentUserHasAnyRelationship,
    fetchAll,
    sendRequest,
    accept,
    deny,
    cancel,
    userIdToPhoneMap,
    userIdToNamesMap,
    findUserByPhone,
    findUsersByPhones,
    findPhonesByUserIds,
    getNamesByUserIds,
    removeFriendship,
    clear,
  }
})
