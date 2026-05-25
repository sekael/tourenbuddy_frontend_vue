import type {
  BlockCooldownError,
  BlockedBySenderError,
} from '@/core/exceptions'
import type { UserBlock } from '@/features/friendships/data/models/user-block-schemas'
import type { BlockedUserInfo } from '@/features/friendships/domain/repositories/user-block-repository'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  BlockAlreadyExistsError,
  NotBlockedError,
} from '@/core/exceptions'
import { useLogger } from '@/core/logging/use-logger'
import { useRealtimeSubscription } from '@/core/realtime/use-realtime-subscription'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { UserBlockRepositoryImpl } from '@/features/friendships/data/repositories/user-block-repository-impl'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  value: boolean
  ts: number
}

const repository = new UserBlockRepositoryImpl()

export const useUserBlocksStore = defineStore('userBlocks', () => {
  const logger = useLogger('UserBlocksStore')
  const authStore = useAuthStore()

  const blocks = ref<UserBlock[]>([])
  const blockedUserInfo = ref(new Map<string, BlockedUserInfo>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isBlockedByCache = ref(new Map<string, CacheEntry>())

  const activeBlocks = computed(() => blocks.value.filter(b => b.unblockedAt === null))
  const blockedUserIds = computed(() => new Set(activeBlocks.value.map(b => b.blockedUserId)))
  const blockedPhones = computed<Set<string>>(() => {
    const result = new Set<string>()
    for (const id of blockedUserIds.value) {
      const phone = blockedUserInfo.value.get(id)?.phone
      if (phone)
        result.add(phone)
    }
    return result
  })

  function invalidateIsBlockedByCache(userId?: string) {
    if (userId) {
      const next = new Map(isBlockedByCache.value)
      next.delete(userId)
      isBlockedByCache.value = next
    }
    else {
      isBlockedByCache.value = new Map()
    }
  }

  async function fetchBlocks() {
    if (!authStore.isAuthenticated)
      return
    loading.value = true
    error.value = null
    try {
      const [rows, infos] = await Promise.all([
        repository.listActive(),
        repository.listBlockedUsers(),
      ])
      blocks.value = rows
      const nextInfo = new Map<string, BlockedUserInfo>()
      for (const info of infos) nextInfo.set(info.userId, info)
      blockedUserInfo.value = nextInfo
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load blocks'
      logger.error('Failed to fetch blocks', err)
    }
    finally {
      loading.value = false
    }
  }

  async function block(userId: string): Promise<void> {
    try {
      await repository.block(userId)
      await fetchBlocks()
      invalidateIsBlockedByCache(userId)
      // block_user cascades a friendship delete + friend_request status update.
      // Realtime should propagate but is racy/lossy across reconnects, so refresh explicitly.
      await useFriendshipsStore().fetchAll()
    }
    catch (err) {
      if (err instanceof BlockAlreadyExistsError)
        return
      throw err
    }
  }

  async function unblock(userId: string): Promise<void> {
    try {
      await repository.unblock(userId)
      blocks.value = blocks.value.filter(b => b.blockedUserId !== userId)
      invalidateIsBlockedByCache(userId)
    }
    catch (err) {
      if (err instanceof NotBlockedError)
        return
      throw err
    }
  }

  async function isBlockedBy(userId: string): Promise<boolean> {
    const cached = isBlockedByCache.value.get(userId)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS)
      return cached.value

    try {
      const value = await repository.isBlockedBy(userId)
      const next = new Map(isBlockedByCache.value)
      next.set(userId, { value, ts: Date.now() })
      isBlockedByCache.value = next
      return value
    }
    catch (err) {
      logger.error('isBlockedBy failed', err)
      return false
    }
  }

  function setBlockedByCache(userId: string, value: boolean) {
    const next = new Map(isBlockedByCache.value)
    next.set(userId, { value, ts: Date.now() })
    isBlockedByCache.value = next
  }

  /** Called from friendships store when send_friend_request returns BlockedBySenderError. */
  function handleSendRejectedByBlock(userId: string) {
    setBlockedByCache(userId, true)
  }

  async function report(userId: string, reason: string | null): Promise<void> {
    await repository.report(userId, reason)
  }

  function clear() {
    blocks.value = []
    blockedUserInfo.value = new Map()
    error.value = null
    isBlockedByCache.value = new Map()
  }

  // Invalidate cache when app becomes visible (tab focus)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible')
        invalidateIsBlockedByCache()
    })
  }

  // Realtime: own block rows + opportunistic signals from friendships/friend_requests
  const channelKey = computed(() => {
    const uid = authStore.currentUser?.id
    return authStore.isAuthenticated && uid ? `user-blocks-${uid}` : null
  })

  useRealtimeSubscription({
    key: () => channelKey.value,
    enabled: () => authStore.isAuthenticated,
    bindings: () => {
      const uid = authStore.currentUser?.id
      if (!uid)
        return []
      return [
        { event: '*', table: 'user_blocks', filter: `blocker_user_id=eq.${uid}` },
        // Opportunistic: friendship deletion or request status change may signal a block
        { event: 'DELETE', table: 'friendships', filter: `request_user_id=eq.${uid}` },
        { event: 'DELETE', table: 'friendships', filter: `response_user_id=eq.${uid}` },
        { event: 'UPDATE', table: 'friend_requests', filter: `from_user_id=eq.${uid}` },
        { event: 'UPDATE', table: 'friend_requests', filter: `to_user_id=eq.${uid}` },
      ]
    },
    onChange: () => {
      invalidateIsBlockedByCache()
      fetchBlocks()
    },
    onSubscribed: () => fetchBlocks(),
  })

  // Clear on sign-out
  watch(
    () => authStore.isAuthenticated,
    (authed) => {
      if (!authed)
        clear()
    },
  )

  return {
    blocks,
    activeBlocks,
    blockedUserIds,
    blockedUserInfo,
    blockedPhones,
    loading,
    error,
    isBlockedByCache,
    fetchBlocks,
    block,
    unblock,
    isBlockedBy,
    handleSendRejectedByBlock,
    invalidateIsBlockedByCache,
    report,
    clear,
  }
})

export type { BlockCooldownError, BlockedBySenderError }
